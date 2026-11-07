/**
 * pdf-service.js - Veli İletişim Çizelgesi (PDF / Yazdır / WhatsApp Paylaş)
 * ve e-Okul PDF / Metin Liste Aktarımı
 * Geliştirici: Fatih PATIR (https://fatihpatir.github.io/web)
 */

class PdfService {
  /**
   * Resmi Veli İletişim Çizelgesini Oluşturur
   * @param {Object} classObj - Sınıf nesnesi (örn. { name: '9/B' })
   * @param {Array} students - Sınıftaki öğrenci listesi
   * @param {Object} settings - { teacherName, schoolName }
   */
  generateOfficialReport(classObj, students, settings) {
    const teacher = settings.teacherName || 'Fatih PATIR';
    const school = settings.schoolName || 'REHBERLİK SERVİSİ';
    const dateStr = new Date().toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    let rowsHtml = '';
    students.forEach((st, idx) => {
      const illnessInfo = st.chronicIllness && st.illnessDetail ? `⚠️ ${st.illnessDetail}` : '-';
      const motherInfo = st.motherName ? `<strong>${st.motherName}</strong><br><small style="color:#2563eb;">${st.motherPhone || '-'}</small>` : '-';
      const fatherInfo = st.fatherName ? `<strong>${st.fatherName}</strong><br><small style="color:#2563eb;">${st.fatherPhone || '-'}</small>` : '-';
      const guardianInfo = st.primaryGuardian === 'Anne' 
        ? 'Anne' 
        : (st.primaryGuardian === 'Baba' ? 'Baba' : (st.guardianName ? `${st.guardianName} (${st.guardianPhone || '-'})` : '-'));

      rowsHtml += `
        <tr>
          <td class="center" style="font-weight: bold;">${idx + 1}</td>
          <td class="center" style="font-weight: bold;">${st.studentNo || '-'}</td>
          <td style="font-weight: 700;">${st.name || '-'}</td>
          <td>${motherInfo}</td>
          <td>${fatherInfo}</td>
          <td class="center">${guardianInfo}</td>
          <td style="font-size: 8pt; color: #b91c1c;">${illnessInfo}</td>
        </tr>
      `;
    });

    const printContainer = document.getElementById('print-container');
    if (printContainer) {
      printContainer.innerHTML = `
        <div class="print-page-header">
          <h2>T.C. MİLLÎ EĞİTİM BAKANLIĞI</h2>
          <h3>${school.toUpperCase()}</h3>
          <h4 style="margin: 6px 0 0 0; font-size: 11pt; color: #1e3a8a;">
            ${classObj.name} SINIFI ÖĞRENCİ-VELİ İLETİŞİM VE BİLGİ ÇİZELGESİ
          </h4>
        </div>

        <div class="print-meta-bar">
          <div><strong>Düzenleyen:</strong> ${teacher}</div>
          <div><strong>Tarih:</strong> ${dateStr}</div>
          <div><strong>Toplam Öğrenci:</strong> ${students.length}</div>
        </div>

        <table class="print-table">
          <thead>
            <tr>
              <th class="center" style="width: 30px;">Sıra</th>
              <th class="center" style="width: 55px;">Okul No</th>
              <th>Öğrenci Adı Soyadı</th>
              <th>Anne Adı & Telefon</th>
              <th>Baba Adı & Telefon</th>
              <th class="center">Asıl Veli</th>
              <th>Kronik Rahatsızlık / Özel Durum</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="7" class="center">Bu sınıfta henüz kayıtlı öğrenci bulunmamaktadır.</td></tr>'}
          </tbody>
        </table>

        <div class="print-signature-row">
          <div class="print-signature-box">
            <p><strong>Hazırlayan</strong></p>
            <p style="margin-top: 5px;">${teacher}</p>
            <p style="font-size: 9pt; color: #555;">Sınıf Rehber Öğretmeni</p>
            <p style="margin-top: 35px; border-bottom: 1px dotted #888; width: 140px; margin-left: auto; margin-right: auto;"></p>
          </div>
          <div class="print-signature-box">
            <p><strong>Onaylayan / Teslim Alan</strong></p>
            <p style="margin-top: 5px;">...................................</p>
            <p style="font-size: 9pt; color: #555;">İdare / Kurum Yetkilisi</p>
            <p style="margin-top: 35px; border-bottom: 1px dotted #888; width: 140px; margin-left: auto; margin-right: auto;"></p>
          </div>
        </div>
      `;
    }
  }

  /**
   * WhatsApp ile Veli Bilgilerini Paylaşma
   */
  shareReportViaWhatsApp(classObj, students, settings) {
    const teacher = settings.teacherName || 'Fatih PATIR';
    let text = `📋 *${classObj.name} Sınıfı Öğrenci-Veli İletişim Çizelgesi*\n`;
    text += `Düzenleyen: ${teacher}\n`;
    text += `Toplam Öğrenci: ${students.length}\n`;
    text += `----------------------------------------\n`;

    students.forEach((st, idx) => {
      text += `*${idx + 1}. [No: ${st.studentNo || '-'}] ${st.name}*\n`;
      if (st.motherName || st.motherPhone) {
        text += `  • Anne: ${st.motherName || '-'} (${st.motherPhone || 'Yok'})\n`;
      }
      if (st.fatherName || st.fatherPhone) {
        text += `  • Baba: ${st.fatherName || '-'} (${st.fatherPhone || 'Yok'})\n`;
      }
      if (st.chronicIllness && st.illnessDetail) {
        text += `  • ⚠️ Kronik Rahatsızlık: ${st.illnessDetail}\n`;
      }
      text += `\n`;
    });

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }

  /**
   * e-Okul PDF'inden Metin Ayrıştırma
   */
  async parsePdfClassList(file) {
    if (!window.pdfjsLib) {
      throw new Error('PDF kütüphanesi yüklenemedi. Lütfen internet bağlantınızı kontrol ediniz veya hızlı metin yapıştırmayı kullanınız.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += ' ' + pageText;
    }

    return this.parseTextClassList(fullText);
  }

  /**
   * Metin İfadelerinden Akıllı Öğrenci Listesi Ayrıştırma
   */
  parseTextClassList(rawText) {
    if (!rawText) return [];
    const parsedStudents = [];

    const regex = /(?:^|\s)(\d{1,6})\s+([A-ZÇĞİÖŞÜa-zçğıöşü\s]{3,40})(?=\s+\d|\s+[KkEe]|\s*$)/g;
    let match;

    while ((match = regex.exec(rawText)) !== null) {
      const studentNo = match[1].trim();
      let name = match[2].trim().replace(/\s+/g, ' ');
      const ignoreWords = ['SINIFI', 'OKULU', 'MÜDÜRLÜĞÜ', 'ŞUBESİ', 'LİSTESİ', 'TOPLAM', 'ÖĞRENCİ', 'SIRA'];
      const isHeader = ignoreWords.some(w => name.toUpperCase().includes(w));
      if (!isHeader && name.length >= 3 && isNaN(name)) {
        parsedStudents.push({
          studentNo: studentNo,
          name: name
        });
      }
    }

    const unique = [];
    const seen = new Set();
    for (const s of parsedStudents) {
      const key = s.studentNo + '_' + s.name;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(s);
      }
    }

    return unique;
  }
}

window.pdfService = new PdfService();
