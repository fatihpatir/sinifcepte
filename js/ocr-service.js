/**
 * ocr-service.js - Sınıf Defterinden / Kağıttan Fotoğrafla Öğrenci Listesi Tarama (OCR)
 * %100 İstemci Tarafında (Cihazda) Çalışır - KVKK Uyumlu
 * Geliştirici: Fatih PATIR (https://fatihpatir.github.io/web)
 */

class OcrService {
  constructor() {
    this.worker = null;
  }

  /**
   * Fotoğrafı OCR için En Uygun Kontrasta Getirir (Gölge ve parlamaları temizler)
   * @param {File|Blob} file 
   * @returns {Promise<HTMLCanvasElement>}
   */
  async preprocessImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // OCR için optimum genişlik sınırı (Çok büyük fotoğrafları 1800px'e ölçekle)
          const MAX_WIDTH = 1800;
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Piksel işleme: Gri tonlama + Kontrast artırma (Thresholding)
          const imgData = ctx.getImageData(0, 0, width, height);
          const d = imgData.data;

          for (let i = 0; i < d.length; i += 4) {
            // Gri ton (Luminance)
            const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
            
            // Kontrast artırma (Yazıları koyulaştır, kağıt zeminini beyazlat)
            const contrast = 1.35;
            const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
            let finalGray = factor * (gray - 128) + 128;
            finalGray = Math.max(0, Math.min(255, finalGray));

            d[i] = finalGray;
            d[i + 1] = finalGray;
            d[i + 2] = finalGray;
          }

          ctx.putImageData(imgData, 0, 0);
          resolve(canvas);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Tesseract.js ile Fotoğraftaki Metinleri Tarar
   * @param {HTMLCanvasElement|File} imageSource 
   * @param {Function} onProgress 
   * @returns {Promise<Array>} - [{ studentNo, name }]
   */
  async scanNotebookPhoto(imageSource, onProgress) {
    if (!window.Tesseract) {
      throw new Error('OCR tarama kütüphanesi yüklenemedi. Lütfen internet bağlantınızı kontrol ediniz.');
    }

    if (onProgress) onProgress({ status: 'Fotoğraf taranıyor...', progress: 0.1 });

    try {
      // Türkçe ve İngilizce alfabe desteğiyle tara
      const res = await window.Tesseract.recognize(
        imageSource,
        'tur+eng',
        {
          logger: (m) => {
            if (onProgress && m.status === 'recognizing text') {
              onProgress({
                status: 'Metinler okunuyor...',
                progress: 0.2 + (m.progress * 0.75)
              });
            }
          }
        }
      );

      const rawText = res.data.text || '';
      return this.parseNotebookText(rawText);

    } catch (err) {
      console.warn('Türkçe OCR paketi yüklenemedi, varsayılan modla taranıyor...', err);
      // Geri düşüş (fallback)
      const res = await window.Tesseract.recognize(imageSource, 'eng');
      return this.parseNotebookText(res.data.text || '');
    }
  }

  /**
   * Sınıf Defteri / Yoklama Listesi Metinlerinden Öğrencileri Ayıklar
   * @param {string} text 
   * @returns {Array} - [{ studentNo, name }]
   */
  parseNotebookText(text) {
    if (!text) return [];

    const lines = text.split(/\r?\n/);
    const parsed = [];

    // İstenmeyen başlık kelimeleri
    const ignoreList = [
      'SINIF', 'DEFTER', 'YOKLAMA', 'İMZA', 'TARİH', 'DERS', 
      'ÖĞRETMEN', 'MİLLİ', 'EĞİTİM', 'BAKANLIĞI', 'MÜDÜRLÜĞÜ', 
      'ŞUBE', 'KIZ', 'MESLEK', 'LİSESİ', 'NO', 'NUMARA', 'ADI', 'SOYADI'
    ];

    lines.forEach((line) => {
      let trimmed = line.trim();
      if (!trimmed || trimmed.length < 4) return;

      // Özel karakterleri temizle (| / _ : [ ] vb.)
      trimmed = trimmed.replace(/[|\\_\[\]~]/g, ' ').replace(/\s+/g, ' ');

      // Kalıp 1: 124 AHMET YILMAZ veya 1  124 AHMET YILMAZ veya 124. AHMET YILMAZ
      // Kalıp 2: AHMET YILMAZ 124
      const match1 = trimmed.match(/(?:^|\s)(?:[0-9]{1,2}[\.\s]+)?([0-9]{1,6})[\s\.\-]+([A-ZÇĞİÖŞÜa-zçğıöşü\s]{3,35})(?=$|\s+[0-9])/);
      const match2 = trimmed.match(/^([A-ZÇĞİÖŞÜa-zçğıöşü\s]{3,35})\s+([0-9]{1,6})$/);

      let no = '';
      let name = '';

      if (match1) {
        no = match1[1].trim();
        name = match1[2].trim();
      } else if (match2) {
        name = match2[1].trim();
        no = match2[2].trim();
      }

      if (no && name && name.length >= 3) {
        // İsimde başlık kelimesi geçiyor mu kontrol et
        const isHeader = ignoreList.some(w => name.toUpperCase().includes(w));
        if (!isHeader) {
          // İsmi düzelt ve kelimeleri baş harfi büyük / tamamı büyük yap
          name = name.replace(/[^a-zA-ZçÇğĞıİöÖşŞüÜ\s]/g, '').trim().toUpperCase();
          if (name.length >= 3) {
            parsed.push({
              studentNo: no,
              name: name
            });
          }
        }
      }
    });

    // Tekrarlananları temizle
    const unique = [];
    const seen = new Set();
    for (const item of parsed) {
      const key = item.studentNo + '_' + item.name;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }

    return unique;
  }
}

window.ocrService = new OcrService();
