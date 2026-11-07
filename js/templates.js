/**
 * templates.js - WhatsApp Mesaj Şablonları ve İletişim Yardımcıları
 * Geliştirici: Fatih PATIR
 */

const WHATSAPP_TEMPLATES = [
  {
    id: 'toplanti',
    title: '📅 Veli Toplantısı Daveti',
    text: 'Sayın Velimiz, okulumuzda düzenlenecek olan veli toplantısına katılımınızı rica ederiz. Öğrencimiz {ogrenci}\'nin akademik ve sosyal gelişimi hakkında görüşmek üzere sizleri bekliyoruz. Saygılarımla, {ogretmen}'
  },
  {
    id: 'gorusme',
    title: '🤝 Özel Görüşme Talebi',
    text: 'Sayın Velimiz, öğrencimiz {ogrenci} ile ilgili olarak görüşmek üzere müsaait olduğunuz bir gün okula davetlisiniz. Saygılarımla, {ogretmen}'
  },
  {
    id: 'devamsizlik',
    title: '⚠️ Devamsızlık Bildirimi',
    text: 'Sayın Velimiz, öğrencimiz {ogrenci} bugün derslere katılmamıştır. Herhangi bir mazeret durumunda tarafıma bilgi vermenizi rica ederim. Saygılarımla, {ogretmen}'
  },
  {
    id: 'tebrik',
    title: '⭐ Tebrik ve Teşekkür',
    text: 'Sayın Velimiz, öğrencimiz {ogrenci} okuldaki gayreti, örnek davranışları ve ders başarısıyla bizleri gururlandırmıştır. Gösterdiğiniz ilgi ve destek için teşekkür ederim. Saygılarımla, {ogretmen}'
  },
  {
    id: 'bilgilendirme',
    title: '📌 Genel Bilgilendirme',
    text: 'Sayın Velimiz, öğrencimiz {ogrenci}\'nin rehberlik ve durum takibi kapsamında: [Mesajınızı buraya yazabilirsiniz]. Saygılarımla, {ogretmen}'
  }
];

// Telefon numarasını Türkiye ve WhatsApp formatına temizleme
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  if (!digits.startsWith('90') && digits.length === 10) {
    digits = '90' + digits;
  }
  return digits;
}

// WhatsApp Bağlantısı Oluştur
function createWhatsAppUrl(phone, templateText, studentName, teacherName) {
  const cleanNum = cleanPhoneNumber(phone);
  if (!cleanNum) return '';

  let message = templateText || '';
  message = message.replace(/{ogrenci}/g, studentName || 'öğrencimiz');
  message = message.replace(/{ogretmen}/g, teacherName || 'Sınıf Rehber Öğretmeni');

  return `https://wa.me/${cleanNum}?text=${encodeURIComponent(message)}`;
}

window.WHATSAPP_TEMPLATES = WHATSAPP_TEMPLATES;
window.cleanPhoneNumber = cleanPhoneNumber;
window.createWhatsAppUrl = createWhatsAppUrl;
