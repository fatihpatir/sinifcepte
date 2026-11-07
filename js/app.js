/**
 * app.js - Öğretmen Rehberlik Asistanı Ana Uygulama Mantığı
 * Geliştirici: Fatih PATIR (https://fatihpatir.github.io/web)
 */

// Uygulama Durumu (State)
const state = {
  currentView: 'home',
  currentClass: null,
  currentStudent: null,
  classes: [],
  students: [],
  deferredPrompt: null,
  settings: {
    teacherName: 'Fatih PATIR',
    websiteUrl: 'https://fatihpatir.github.io/web',
    schoolName: 'Nene Hatun Kız MTAL'
  }
};

// Uygulama Başlatma
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 0. Temayı yükle
    initTheme();

    // 1. Veritabanını başlat
    await window.db.init();

    // 2. Ayarları yükle
    await loadSettings();

    // 3. PWA Kurulum & Olay Dinleyicileri
    setupPwaInstall();
    setupMobilePreventDoubleTap();
    setupEventListeners();

    // 4. Ana ekranı yükle
    await renderHome();

  } catch (err) {
    console.error('Uygulama başlatma hatası:', err);
    alert('Uygulama başlatılırken bir sorun oluştu. Sayfayı yenileyebilirsiniz.');
  }
});

/* ==========================================================================
   1. Görünüm Temaları (Aydınlık / Koyu / Gece Safiri)
   ========================================================================== */
function initTheme() {
  const savedTheme = localStorage.getItem('rehberlik_theme') || 'light';
  applyTheme(savedTheme);
}

function applyTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName);
  localStorage.setItem('rehberlik_theme', themeName);

  // Buton aktifliklerini güncelle
  document.querySelectorAll('.theme-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === themeName);
  });

  // Header tema simgesini güncelle
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    if (themeName === 'dark') themeToggleBtn.textContent = '🌙';
    else if (themeName === 'midnight') themeToggleBtn.textContent = '🌌';
    else themeToggleBtn.textContent = '☀️';
  }
}

function toggleThemeNext() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'light' ? 'dark' : (current === 'dark' ? 'midnight' : 'light');
  applyTheme(next);
}

/* ==========================================================================
   2. Ayarlar & Profil Yükleme
   ========================================================================== */
async function loadSettings() {
  const teacherName = await window.db.getSetting('teacherName') || 'Fatih PATIR';
  let schoolName = await window.db.getSetting('schoolName');
  
  // Eğer eski kayıt "Rehberlik Servisi" kalmışsa doğrudan Nene Hatun Kız MTAL yap
  if (!schoolName || schoolName === 'Rehberlik Servisi') {
    schoolName = 'Nene Hatun Kız MTAL';
    await window.db.setSetting('schoolName', schoolName);
  }

  state.settings = { teacherName, schoolName };

  // Header güncelle
  const headerTeacherName = document.getElementById('header-teacher-name');
  if (headerTeacherName) headerTeacherName.textContent = teacherName;

  const headerSchoolGreeting = document.getElementById('header-school-greeting');
  if (headerSchoolGreeting) headerSchoolGreeting.textContent = schoolName;

  // Ayarlar modalındaki kutuları güncelle
  const settingsTeacherInput = document.getElementById('settings-teacher-name');
  if (settingsTeacherInput) settingsTeacherInput.value = teacherName;

  const settingsSchoolInput = document.getElementById('settings-school-name');
  if (settingsSchoolInput) settingsSchoolInput.value = schoolName;
}

/* ==========================================================================
   3. PWA Kurulum & Mobil Akıllı Bildirimler (iOS & Android)
   ========================================================================== */
function setupPwaInstall() {
  const pwaBtn = document.getElementById('pwa-install-btn');
  const banner = document.getElementById('smart-install-banner');
  const bannerTitle = document.getElementById('banner-title');
  const bannerText = document.getElementById('banner-text');
  const bannerActionBtn = document.getElementById('banner-action-btn');

  // Zaten yüklü mü kontrol et (Standalone mod)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isDismissed = sessionStorage.getItem('install_banner_dismissed') === 'true';

  if (isStandalone || isDismissed) {
    if (banner) banner.style.display = 'none';
    return;
  }

  // iOS (iPhone / iPad) Tespiti
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isIos && banner) {
    bannerTitle.textContent = "🍎 iPhone'da Ana Ekrana Ekleyin";
    bannerText.textContent = "Alttaki Paylaş (📤) simgesine basıp 'Ana Ekrana Ekle'yi seçin.";
    bannerActionBtn.textContent = "Nasıl Yapılır? ℹ️";
    bannerActionBtn.onclick = () => openModal('modal-install-guide');
    banner.style.display = 'flex';
  }

  // Android / Chrome Otomatik Yükleme Olayı
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    if (pwaBtn) pwaBtn.style.display = 'inline-flex';

    if (banner && !isIos) {
      bannerTitle.textContent = "📲 SınıfCepte'yi Telefona Yükleyin";
      bannerText.textContent = "Tek dokunuşla internetsiz de bir mobil uygulama gibi kullanın.";
      bannerActionBtn.textContent = "📲 Hemen Yükle";
      bannerActionBtn.onclick = async () => {
        if (state.deferredPrompt) {
          state.deferredPrompt.prompt();
          const { outcome } = await state.deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            banner.style.display = 'none';
            if (pwaBtn) pwaBtn.style.display = 'none';
          }
          state.deferredPrompt = null;
        }
      };
      banner.style.display = 'flex';
    }
  });

  if (pwaBtn) {
    pwaBtn.addEventListener('click', async () => {
      if (state.deferredPrompt) {
        state.deferredPrompt.prompt();
        const { outcome } = await state.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          pwaBtn.style.display = 'none';
        }
        state.deferredPrompt = null;
      } else {
        openModal('modal-install-guide');
      }
    });
  }
}

function dismissInstallBanner() {
  const banner = document.getElementById('smart-install-banner');
  if (banner) banner.style.display = 'none';
  sessionStorage.setItem('install_banner_dismissed', 'true');
}

window.dismissInstallBanner = dismissInstallBanner;

function setupMobilePreventDoubleTap() {
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
        event.preventDefault();
      }
    }
    lastTouchEnd = now;
  }, false);
}

/* ==========================================================================
   3. Görünüm (View) Yönetimi
   ========================================================================== */
function switchView(viewName) {
  state.currentView = viewName;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.classList.add('active');
    window.scrollTo(0, 0);
  }
}

/* ==========================================================================
   4. Ana Ekran (Home) & Sınıflar
   ========================================================================== */
async function renderHome() {
  switchView('home');
  const classesGrid = document.getElementById('classes-grid');
  const totalClassesCount = document.getElementById('total-classes-count');
  const totalStudentsCount = document.getElementById('total-students-count');
  const chronicAlertCount = document.getElementById('chronic-alert-count');

  if (!classesGrid) return;

  const classes = await window.db.getAllClasses();
  const allStudents = await window.db.getAllStudents();
  state.classes = classes;
  state.students = allStudents;

  // İstatistikler
  if (totalClassesCount) totalClassesCount.textContent = classes.length;
  if (totalStudentsCount) totalStudentsCount.textContent = allStudents.length;

  const chronicStudents = allStudents.filter(s => s.chronicIllness === true || s.chronicIllness === 'true');
  if (chronicAlertCount) chronicAlertCount.textContent = chronicStudents.length;

  // Sınıf Yoksa (Boş Ekran)
  if (classes.length === 0) {
    classesGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 42px 20px; background: var(--surface); border: 2px dashed var(--border); border-radius: 20px;">
        <span style="font-size: 44px; display: block; margin-bottom: 10px;">🏫</span>
        <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 6px; color: var(--text-main);">Henüz Kayıtlı Sınıf Yok</h3>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px; max-width: 380px; margin-left: auto; margin-right: auto;">
          Sisteme sınıf ekleyerek başlayabilirsiniz. Eklediğiniz sınıfların içine öğrenciler ve veli bilgileri tanımlanacaktır.
        </p>
        <button class="action-btn primary" onclick="openModal('modal-add-class')" style="font-size: 14px; padding: 12px 20px;">
          ➕ İlk Sınıfınızı Ekleyin
        </button>
      </div>
    `;
    return;
  }

  // Sınıf kartları HTML
  let cardsHtml = '';
  for (const cls of classes) {
    const stCount = allStudents.filter(s => s.classId === cls.id).length;
    cardsHtml += `
      <div class="class-card" onclick="openClassDetail('${cls.id}')">
        <div class="class-card-header">
          <div class="class-name">${cls.name}</div>
          <span class="class-badge">${stCount} Öğrenci</span>
        </div>
        <div class="class-card-footer">
          <span>Listeyi Aç</span>
          <span style="font-size: 15px;">›</span>
        </div>
      </div>
    `;
  }

  // Yeni Sınıf Ekle Kartı
  cardsHtml += `
    <div class="add-class-card" onclick="openModal('modal-add-class')">
      <span style="font-size: 26px;">➕</span>
      <span>Yeni Sınıf Ekle</span>
    </div>
  `;

  classesGrid.innerHTML = cardsHtml;
}

/* ==========================================================================
   5. Canlı Öğrenci Arama (Tüm Sınıflarda)
   ========================================================================== */
function setupSearch() {
  const searchInput = document.getElementById('global-search-input');
  const searchClear = document.getElementById('search-clear-btn');
  const resultsPanel = document.getElementById('search-results-panel');

  if (!searchInput || !resultsPanel) return;

  searchInput.addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    if (query.length > 0) {
      if (searchClear) searchClear.style.display = 'flex';
      const results = await window.db.searchStudents(query);
      renderSearchResults(results, resultsPanel);
    } else {
      if (searchClear) searchClear.style.display = 'none';
      resultsPanel.classList.remove('open');
      resultsPanel.innerHTML = '';
    }
  });

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.style.display = 'none';
      resultsPanel.classList.remove('open');
      resultsPanel.innerHTML = '';
      searchInput.focus();
    });
  }

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !resultsPanel.contains(e.target)) {
      resultsPanel.classList.remove('open');
    }
  });
}

function renderSearchResults(students, container) {
  if (students.length === 0) {
    container.innerHTML = `
      <div style="padding: 18px; text-align: center; color: var(--text-muted); font-size: 13.5px; font-weight: 500;">
        🔍 Eşleşen öğrenci bulunamadı.
      </div>
    `;
    container.classList.add('open');
    return;
  }

  let html = '';
  students.slice(0, 8).forEach(st => {
    const cls = state.classes.find(c => c.id === st.classId);
    const className = cls ? cls.name : 'Sınıfsız';
    const avatarHtml = st.photo 
      ? `<img src="${st.photo}" alt="${st.name}">` 
      : (st.name ? st.name.charAt(0) : '?');

    html += `
      <div class="search-result-item" onclick="openStudentDetail('${st.id}')">
        <div class="student-avatar" style="width: 40px; height: 40px; font-size: 14px;">${avatarHtml}</div>
        <div class="student-info-col" style="flex: 1;">
          <div class="student-name">${st.name}</div>
          <div class="student-sub-detail">
            <span>No: <strong>${st.studentNo || '-'}</strong></span> • 
            <span style="font-weight: 800; color: var(--primary);">${className}</span>
            ${st.chronicIllness ? '<span class="badge-tag illness">Hastalık</span>' : ''}
          </div>
        </div>
        <span style="color: var(--text-muted); font-size: 16px;">›</span>
      </div>
    `;
  });

  container.innerHTML = html;
  container.classList.add('open');
}

/* ==========================================================================
   6. Sınıf Detayı (Sınıf Listesi Ekranı & Sınıf Düzenle / Sil)
   ========================================================================== */
async function openClassDetail(classId) {
  const cls = await window.db.getClass(classId);
  if (!cls) return;

  state.currentClass = cls;
  switchView('class');

  const titleEl = document.getElementById('class-view-title');
  if (titleEl) titleEl.textContent = `${cls.name} Sınıfı`;

  await renderClassStudents();
}

// Sınıf Adını Düzenleme Modalı
function openEditClassModal() {
  if (!state.currentClass) return;
  document.getElementById('edit-class-name-input').value = state.currentClass.name;
  openModal('modal-edit-class');
}

// Sınıfı Silme (Onay Sorarak)
async function deleteCurrentClass() {
  if (!state.currentClass) return;
  const clsName = state.currentClass.name;
  const confirmed = confirm(`⚠️ DİKKAT:\n"${clsName}" sınıfını ve bu sınıftaki TÜM öğrencileri silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!`);
  
  if (confirmed) {
    await window.db.deleteClass(state.currentClass.id);
    alert(`"${clsName}" sınıfı başarıyla silindi.`);
    state.currentClass = null;
    await renderHome();
  }
}

async function renderClassStudents() {
  const container = document.getElementById('class-students-list');
  if (!container || !state.currentClass) return;

  const students = await window.db.getStudentsByClass(state.currentClass.id);
  const countBadge = document.getElementById('class-student-count-badge');
  if (countBadge) countBadge.textContent = `${students.length} Öğrenci`;

  if (students.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 45px 20px; background: var(--surface); border: 1.5px dashed var(--border); border-radius: 18px;">
        <span style="font-size: 40px; display: block; margin-bottom: 10px;">👥</span>
        <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 4px;">Bu sınıfta henüz öğrenci yok</h3>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 18px;">
          Yukarıdaki <strong>"Öğrenci Ekle"</strong> veya <strong>"PDF'ten Yükle"</strong> butonlarını kullanarak öğrenci ekleyebilirsiniz.
        </p>
        <button class="action-btn primary" onclick="openAddStudentModal()">➕ İlk Öğrenciyi Ekle</button>
      </div>
    `;
    return;
  }

  let html = '';
  students.forEach(st => {
    const avatarHtml = st.photo 
      ? `<img src="${st.photo}" alt="${st.name}">` 
      : (st.name ? st.name.charAt(0) : '?');

    let badges = '';
    if (st.chronicIllness === true || st.chronicIllness === 'true') {
      badges += `<span class="badge-tag illness">🔴 ${st.illnessDetail || 'Rahatsızlık'}</span>`;
    }
    if (st.parentsTogether === 'Ayrı') {
      badges += `<span class="badge-tag family">⚠️ Veli Ayrı</span>`;
    }

    const primaryPhone = st.primaryGuardian === 'Baba' 
      ? (st.fatherPhone || st.motherPhone) 
      : (st.motherPhone || st.fatherPhone || st.guardianPhone);

    html += `
      <div class="student-card" onclick="openStudentDetail('${st.id}')">
        <div class="student-card-left">
          <div class="student-avatar">${avatarHtml}</div>
          <div class="student-info-col">
            <div class="student-name">${st.name}</div>
            <div class="student-sub-detail">
              <span>No: <strong>${st.studentNo || '-'}</strong></span>
              ${primaryPhone ? `<span>• 📞 ${primaryPhone}</span>` : ''}
            </div>
            ${badges ? `<div style="display: flex; gap: 4px; margin-top: 4px;">${badges}</div>` : ''}
          </div>
        </div>
        <span style="color: var(--text-muted); font-size: 18px; font-weight: bold;">›</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

/* ==========================================================================
   7. Öğrenci Detay Sayfası & Hızlı Düzenleme
   ========================================================================= */
async function openStudentDetail(studentId) {
  const student = await window.db.getStudent(studentId);
  if (!student) return;

  state.currentStudent = student;
  switchView('student');

  const photoEl = document.getElementById('profile-photo-img');
  if (photoEl) {
    photoEl.src = student.photo || 'icons/icon.svg';
  }

  document.getElementById('profile-student-name').textContent = student.name || '-';
  const cls = state.classes.find(c => c.id === student.classId);
  const className = cls ? cls.name : '';
  document.getElementById('profile-student-meta').textContent = `${className} • Okul No: ${student.studentNo || '-'}`;

  // Sağlık Bilgileri
  const illnessBadge = document.getElementById('det-illness-badge');
  const illnessDetail = document.getElementById('det-illness-detail');
  const emergencyAction = document.getElementById('det-emergency-action');

  const hasIllness = student.chronicIllness === true || student.chronicIllness === 'true';
  illnessBadge.textContent = hasIllness ? '⚠️ VAR' : 'YOK';
  illnessBadge.className = `badge-tag ${hasIllness ? 'illness' : 'family'}`;
  illnessDetail.textContent = student.illnessDetail || (hasIllness ? 'Detay girilmemiş' : 'Bilinen rahatsızlığı yok');
  emergencyAction.textContent = student.emergencyAction || '-';

  // Aile Bilgileri
  document.getElementById('det-family-status').textContent = student.parentsTogether || 'Birlikte';
  document.getElementById('det-sibling-count').textContent = student.siblingCount ? `${student.siblingCount} Kardeş` : '-';
  
  // Anne
  document.getElementById('det-mother-name').textContent = student.motherName || '-';
  document.getElementById('det-mother-status').textContent = student.motherAlive === 'Vefat' ? 'Vefat' : 'Sağ';
  document.getElementById('det-mother-job').textContent = student.motherJob || '-';
  const mPhoneEl = document.getElementById('det-mother-phone');
  mPhoneEl.textContent = student.motherPhone || 'Yok';
  mPhoneEl.onclick = () => student.motherPhone && openContactActionModal(student.motherPhone, student.motherName || 'Anne', 'Anne');

  // Baba
  document.getElementById('det-father-name').textContent = student.fatherName || '-';
  document.getElementById('det-father-status').textContent = student.fatherAlive === 'Vefat' ? 'Vefat' : 'Sağ';
  document.getElementById('det-father-job').textContent = student.fatherJob || '-';
  const fPhoneEl = document.getElementById('det-father-phone');
  fPhoneEl.textContent = student.fatherPhone || 'Yok';
  fPhoneEl.onclick = () => student.fatherPhone && openContactActionModal(student.fatherPhone, student.fatherName || 'Baba', 'Baba');

  // Veli
  document.getElementById('det-primary-guardian').textContent = student.primaryGuardian || 'Anne / Baba';

  // İletişim & Adres
  const stPhoneEl = document.getElementById('det-student-phone');
  stPhoneEl.textContent = student.phone || 'Yok';
  stPhoneEl.onclick = () => student.phone && openContactActionModal(student.phone, student.name, 'Öğrenci');
  document.getElementById('det-student-address').textContent = student.address || '-';

  // Hızlı Arama Butonları
  const quickMotherCall = document.getElementById('quick-call-mother');
  const quickFatherCall = document.getElementById('quick-call-father');
  
  if (quickMotherCall) {
    quickMotherCall.onclick = () => {
      if (student.motherPhone) openContactActionModal(student.motherPhone, student.motherName || 'Anne', 'Anne');
      else alert('Kayıtlı anne telefonu bulunmamaktadır.');
    };
  }
  if (quickFatherCall) {
    quickFatherCall.onclick = () => {
      if (student.fatherPhone) openContactActionModal(student.fatherPhone, student.fatherName || 'Baba', 'Baba');
      else alert('Kayıtlı baba telefonu bulunmamaktadır.');
    };
  }

  // Görüşme Notlarını Yükle
  await renderStudentNotes(student.id);
}

/* ==========================================================================
   8. Fotoğraf Çekme & Optimize Etme (HTML5 Canvas)
   ========================================================================== */
function setupPhotoCapture() {
  const photoInput = document.getElementById('camera-file-input');
  if (!photoInput) return;

  photoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !state.currentStudent) return;

    try {
      const compressedDataUrl = await resizeImage(file, 400, 400);
      state.currentStudent.photo = compressedDataUrl;
      await window.db.saveStudent(state.currentStudent);

      const imgEl = document.getElementById('profile-photo-img');
      if (imgEl) imgEl.src = compressedDataUrl;

      await renderClassStudents();
    } catch (err) {
      console.error('Fotoğraf yükleme hatası:', err);
      alert('Fotoğraf işlenirken bir sorun oluştu.');
    }
  });
}

function resizeImage(file, maxWidth, maxHeight) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        let width = image.width;
        let height = image.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.onerror = reject;
      image.src = readerEvent.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ==========================================================================
   9. Hızlı Alan Düzenleme (Tek Kalem Simgesi İle)
   ========================================================================== */
function openInlineEditModal(section) {
  if (!state.currentStudent) return;
  const st = state.currentStudent;

  const title = document.getElementById('inline-edit-title');
  const body = document.getElementById('inline-edit-fields');
  title.textContent = `${section} Bilgilerini Güncelle`;

  let fieldsHtml = '';

  if (section === 'Sağlık') {
    fieldsHtml = `
      <div class="toggle-switch-wrap">
        <label class="form-label" style="margin-bottom:0;">Kronik Rahatsızlığı Var mı?</label>
        <select id="ie-chronicIllness" class="form-control" style="width: auto;">
          <option value="false" ${!st.chronicIllness || st.chronicIllness === 'false' ? 'selected' : ''}>HAYIR</option>
          <option value="true" ${st.chronicIllness === true || st.chronicIllness === 'true' ? 'selected' : ''}>EVET</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Rahatsızlık & Alerji Detayı:</label>
        <input type="text" id="ie-illnessDetail" class="form-control" value="${st.illnessDetail || ''}" placeholder="Örn: Astım, Diyabet, Fıstık Alerjisi">
      </div>
      <div class="form-group">
        <label class="form-label">Acil Durumda Yapılacaklar / İlaç:</label>
        <textarea id="ie-emergencyAction" class="form-control" rows="2" placeholder="Örn: Çantasındaki hava spreyi verilmeli">${st.emergencyAction || ''}</textarea>
      </div>
    `;
  } else if (section === 'Aile') {
    fieldsHtml = `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Anne - Baba Durumu:</label>
          <select id="ie-parentsTogether" class="form-control">
            <option value="Birlikte" ${st.parentsTogether === 'Birlikte' ? 'selected' : ''}>Birlikte</option>
            <option value="Ayrı" ${st.parentsTogether === 'Ayrı' ? 'selected' : ''}>Ayrı (Boşanmış)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Kardeş Sayısı:</label>
          <input type="number" id="ie-siblingCount" class="form-control" value="${st.siblingCount || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Anne Adı:</label>
          <input type="text" id="ie-motherName" class="form-control" value="${st.motherName || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Anne Telefonu:</label>
          <input type="tel" id="ie-motherPhone" class="form-control" value="${st.motherPhone || ''}" placeholder="05xx...">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Anne Mesleği:</label>
          <input type="text" id="ie-motherJob" class="form-control" value="${st.motherJob || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Anne Durumu:</label>
          <select id="ie-motherAlive" class="form-control">
            <option value="Sağ" ${st.motherAlive !== 'Vefat' ? 'selected' : ''}>Sağ</option>
            <option value="Vefat" ${st.motherAlive === 'Vefat' ? 'selected' : ''}>Vefat</option>
          </select>
        </div>
      </div>
      <hr style="margin: 12px 0; border: none; border-top: 1px solid var(--border);">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Baba Adı:</label>
          <input type="text" id="ie-fatherName" class="form-control" value="${st.fatherName || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Baba Telefonu:</label>
          <input type="tel" id="ie-fatherPhone" class="form-control" value="${st.fatherPhone || ''}" placeholder="05xx...">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Baba Mesleği:</label>
          <input type="text" id="ie-fatherJob" class="form-control" value="${st.fatherJob || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Baba Durumu:</label>
          <select id="ie-fatherAlive" class="form-control">
            <option value="Sağ" ${st.fatherAlive !== 'Vefat' ? 'selected' : ''}>Sağ</option>
            <option value="Vefat" ${st.fatherAlive === 'Vefat' ? 'selected' : ''}>Vefat</option>
          </select>
        </div>
      </div>
    `;
  } else if (section === 'İletişim') {
    fieldsHtml = `
      <div class="form-group">
        <label class="form-label">Öğrenci Kendi Telefon Numarası:</label>
        <input type="tel" id="ie-phone" class="form-control" value="${st.phone || ''}" placeholder="05xx...">
      </div>
      <div class="form-group">
        <label class="form-label">Ev Adresi / İkametgah:</label>
        <textarea id="ie-address" class="form-control" rows="3">${st.address || ''}</textarea>
      </div>
    `;
  }

  body.innerHTML = fieldsHtml;

  document.getElementById('inline-edit-save-btn').onclick = async () => {
    if (section === 'Sağlık') {
      st.chronicIllness = document.getElementById('ie-chronicIllness').value === 'true';
      st.illnessDetail = document.getElementById('ie-illnessDetail').value.trim();
      st.emergencyAction = document.getElementById('ie-emergencyAction').value.trim();
    } else if (section === 'Aile') {
      st.parentsTogether = document.getElementById('ie-parentsTogether').value;
      st.siblingCount = document.getElementById('ie-siblingCount').value.trim();
      st.motherName = document.getElementById('ie-motherName').value.trim();
      st.motherPhone = document.getElementById('ie-motherPhone').value.trim();
      st.motherJob = document.getElementById('ie-motherJob').value.trim();
      st.motherAlive = document.getElementById('ie-motherAlive').value;
      st.fatherName = document.getElementById('ie-fatherName').value.trim();
      st.fatherPhone = document.getElementById('ie-fatherPhone').value.trim();
      st.fatherJob = document.getElementById('ie-fatherJob').value.trim();
      st.fatherAlive = document.getElementById('ie-fatherAlive').value;
    } else if (section === 'İletişim') {
      st.phone = document.getElementById('ie-phone').value.trim();
      st.address = document.getElementById('ie-address').value.trim();
    }

    await window.db.saveStudent(st);
    closeModal('modal-inline-edit');
    await openStudentDetail(st.id);
  };

  openModal('modal-inline-edit');
}

/* ==========================================================================
   10. Arama / WhatsApp Mesaj Seçme Modalı
   ========================================================================== */
function openContactActionModal(phone, personName, relation) {
  document.getElementById('contact-action-person').textContent = `${personName} (${relation})`;
  document.getElementById('contact-action-phone-display').textContent = phone;

  document.getElementById('btn-call-direct').onclick = () => {
    window.location.href = `tel:${phone}`;
  };

  document.getElementById('btn-wa-direct').onclick = () => {
    const waUrl = window.createWhatsAppUrl(phone, '', state.currentStudent?.name, state.settings.teacherName);
    window.open(waUrl, '_blank');
  };

  const templateListContainer = document.getElementById('wa-templates-list');
  if (templateListContainer) {
    let tplHtml = '';
    window.WHATSAPP_TEMPLATES.forEach(tpl => {
      tplHtml += `
        <div class="template-item" onclick="sendWhatsAppTemplate('${phone}', '${tpl.id}')">
          <div class="template-title">${tpl.title}</div>
          <div class="template-preview">${tpl.text.substring(0, 75)}...</div>
        </div>
      `;
    });
    templateListContainer.innerHTML = tplHtml;
  }

  openModal('modal-contact-action');
}

function sendWhatsAppTemplate(phone, templateId) {
  const tpl = window.WHATSAPP_TEMPLATES.find(t => t.id === templateId);
  if (!tpl) return;
  const waUrl = window.createWhatsAppUrl(
    phone, 
    tpl.text, 
    state.currentStudent?.name, 
    state.settings.teacherName
  );
  window.open(waUrl, '_blank');
  closeModal('modal-contact-action');
}

/* ==========================================================================
   11. Veli İletişim Çizelgesi (PDF / Yazdır / WhatsApp Paylaş)
   ========================================================================== */
async function openOfficialReportModal() {
  if (!state.currentClass) return;

  const students = await window.db.getStudentsByClass(state.currentClass.id);
  window.pdfService.generateOfficialReport(state.currentClass, students, state.settings);

  document.getElementById('report-class-name').textContent = `${state.currentClass.name} Sınıfı`;

  // Yazdır / PDF Olarak Kaydet
  document.getElementById('btn-print-official-pdf').onclick = () => {
    window.print();
  };

  // WhatsApp ile Paylaş
  document.getElementById('btn-share-official-wa').onclick = () => {
    window.pdfService.shareReportViaWhatsApp(state.currentClass, students, state.settings);
  };

  openModal('modal-official-report');
}

/* ==========================================================================
   12. PDF / Metin İle Sınıf Listesi Aktarma (e-Okul)
   ========================================================================== */
function setupPdfImport() {
  const fileInput = document.getElementById('pdf-file-input');
  const parseBtn = document.getElementById('btn-parse-pdf');
  const pasteInput = document.getElementById('paste-text-input');
  const previewContainer = document.getElementById('pdf-import-preview');

  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        previewContainer.innerHTML = '<p style="padding:15px; text-align:center; font-size:13px;">⏳ PDF taranıyor, lütfen bekleyiniz...</p>';
        const parsed = await window.pdfService.parsePdfClassList(file);
        renderParsedListPreview(parsed);
      } catch (err) {
        alert(err.message || 'PDF okunurken hata oluştu. Metin kutusuna yapıştırarak deneyebilirsiniz.');
        previewContainer.innerHTML = '';
      }
    });
  }

  if (parseBtn) {
    parseBtn.addEventListener('click', () => {
      const raw = pasteInput.value.trim();
      if (!raw) {
        alert('Lütfen e-okuldan kopyaladığınız listeyi metin alanına yapıştırınız.');
        return;
      }
      const parsed = window.pdfService.parseTextClassList(raw);
      renderParsedListPreview(parsed);
    });
  }
}

function renderParsedListPreview(parsedStudents) {
  const previewContainer = document.getElementById('pdf-import-preview');
  if (!parsedStudents || parsedStudents.length === 0) {
    previewContainer.innerHTML = `
      <p style="color:var(--danger); padding:10px; font-size:13px; text-align:center;">
        ❌ Öğrenci bulunamadı. Lütfen liste formatını kontrol edip elle yapıştırmayı deneyiniz.
      </p>
    `;
    return;
  }

  let html = `
    <div style="background:#ecfdf5; border:1px solid #a7f3d0; padding:10px 12px; border-radius:10px; margin-bottom:12px; font-size:13px; color:#065f46;">
      ✅ <strong>${parsedStudents.length} öğrenci</strong> bulundu! Kontrol edip onaylayınız:
    </div>
    <div style="max-height: 220px; overflow-y: auto; border: 1px solid var(--border); border-radius: 10px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #f1f5f9; text-align: left;">
            <th style="padding: 8px 10px;">No</th>
            <th style="padding: 8px 10px;">Adı Soyadı</th>
          </tr>
        </thead>
        <tbody>
  `;

  parsedStudents.forEach(s => {
    html += `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 7px 10px; font-weight: bold;">${s.studentNo}</td>
        <td style="padding: 7px 10px;">${s.name}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  previewContainer.innerHTML = html;

  const confirmBtn = document.getElementById('btn-confirm-import');
  if (confirmBtn) {
    confirmBtn.style.display = 'inline-flex';
    confirmBtn.onclick = async () => {
      for (const st of parsedStudents) {
        await window.db.saveStudent({
          classId: state.currentClass.id,
          studentNo: st.studentNo,
          name: st.name
        });
      }
      closeModal('modal-pdf-import');
      await renderClassStudents();
      alert(`${parsedStudents.length} öğrenci ${state.currentClass.name} sınıfına başarıyla aktarıldı!`);
    };
  }
}

/* ==========================================================================
   13. Rehberlik / Görüşme Notları
   ========================================================================== */
async function renderStudentNotes(studentId) {
  const container = document.getElementById('student-notes-list');
  if (!container) return;

  const notes = await window.db.getNotesByStudent(studentId);
  if (notes.length === 0) {
    container.innerHTML = `
      <div style="font-size: 12.5px; color: var(--text-muted); text-align: center; padding: 12px;">
        Kayıtlı rehberlik görüşmesi bulunmuyor.
      </div>
    `;
    return;
  }

  let html = '';
  notes.forEach(n => {
    const dateStr = new Date(n.date).toLocaleDateString('tr-TR');
    html += `
      <div class="note-item">
        <div class="note-item-header">
          <span>📅 ${dateStr}</span>
          <span class="note-badge">${n.person || 'Görüşme'}</span>
        </div>
        <div style="font-weight: 800; margin-bottom: 3px;">${n.subject || 'Konu'}</div>
        <div style="color: var(--text-sub); line-height: 1.45;">${n.details || ''}</div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/* ==========================================================================
   14. Modal Açma / Kapama Yardımcıları
   ========================================================================== */
function openModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.add('open');
}

function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.remove('open');
}

/* ==========================================================================
   15. Genel Olay Dinleyicileri (Event Listeners)
   ========================================================================== */
function setupEventListeners() {
  setupSearch();
  setupPhotoCapture();
  setupPdfImport();
  setupOcrListeners();

  const backToHomeBtn = document.getElementById('back-to-home-btn');
  if (backToHomeBtn) {
    backToHomeBtn.addEventListener('click', () => renderHome());
  }

  const backToClassBtn = document.getElementById('back-to-class-btn');
  if (backToClassBtn) {
    backToClassBtn.addEventListener('click', () => {
      if (state.currentClass) openClassDetail(state.currentClass.id);
      else renderHome();
    });
  }

  // Yeni Sınıf Ekleme Formu
  const addClassForm = document.getElementById('form-add-class');
  if (addClassForm) {
    addClassForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('new-class-name');
      const name = nameInput.value.trim();
      if (!name) return;

      await window.db.addClass({ name });
      nameInput.value = '';
      closeModal('modal-add-class');
      await renderHome();
    });
  }

  // Sınıf Adı Düzenleme Formu
  const editClassForm = document.getElementById('form-edit-class');
  if (editClassForm) {
    editClassForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.currentClass) return;
      const newName = document.getElementById('edit-class-name-input').value.trim();
      if (!newName) return;

      await window.db.updateClassName(state.currentClass.id, newName);
      state.currentClass.name = newName.toUpperCase();
      document.getElementById('class-view-title').textContent = `${state.currentClass.name} Sınıfı`;
      closeModal('modal-edit-class');
      await renderClassStudents();
    });
  }

  // Öğrenci Kaydetme Formu
  const studentForm = document.getElementById('form-student-full');
  if (studentForm) {
    studentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const stId = document.getElementById('st-form-id').value;
      const stObj = {
        id: stId || undefined,
        classId: state.currentClass.id,
        studentNo: document.getElementById('st-form-no').value.trim(),
        name: document.getElementById('st-form-name').value.trim(),
        phone: document.getElementById('st-form-phone').value.trim(),
        address: document.getElementById('st-form-address').value.trim(),
        chronicIllness: document.getElementById('st-form-chronic').value === 'true',
        illnessDetail: document.getElementById('st-form-illness-detail').value.trim(),
        emergencyAction: document.getElementById('st-form-emergency').value.trim(),
        parentsTogether: document.getElementById('st-form-parents-together').value,
        siblingCount: document.getElementById('st-form-sibling').value.trim(),
        motherName: document.getElementById('st-form-mother-name').value.trim(),
        motherPhone: document.getElementById('st-form-mother-phone').value.trim(),
        motherJob: document.getElementById('st-form-mother-job').value.trim(),
        motherAlive: document.getElementById('st-form-mother-alive').value,
        fatherName: document.getElementById('st-form-father-name').value.trim(),
        fatherPhone: document.getElementById('st-form-father-phone').value.trim(),
        fatherJob: document.getElementById('st-form-father-job').value.trim(),
        fatherAlive: document.getElementById('st-form-father-alive').value,
        primaryGuardian: document.getElementById('st-form-guardian').value
      };

      if (stId && state.currentStudent && state.currentStudent.photo) {
        stObj.photo = state.currentStudent.photo;
      }

      await window.db.saveStudent(stObj);
      closeModal('modal-student-full');
      await renderClassStudents();
      if (stId) {
        await openStudentDetail(stId);
      }
    });
  }

  // Not Ekleme Formu
  const noteForm = document.getElementById('form-add-note');
  if (noteForm) {
    noteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.currentStudent) return;
      const note = {
        studentId: state.currentStudent.id,
        person: document.getElementById('note-form-person').value,
        subject: document.getElementById('note-form-subject').value.trim(),
        details: document.getElementById('note-form-details').value.trim()
      };
      await window.db.addNote(note);
      document.getElementById('note-form-subject').value = '';
      document.getElementById('note-form-details').value = '';
      closeModal('modal-add-note');
      await renderStudentNotes(state.currentStudent.id);
    });
  }

  // Yedek İndirme
  const exportBtn = document.getElementById('btn-export-backup');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const json = await window.db.exportBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rehberlik_Yedek_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Yedek Yükleme
  const importFile = document.getElementById('backup-file-input');
  if (importFile) {
    importFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (re) => {
        const res = await window.db.importBackup(re.target.result);
        if (res.success) {
          alert(`Yedek başarıyla yüklendi! (${res.count} öğrenci güncellendi)`);
          closeModal('modal-settings');
          await loadSettings();
          await renderHome();
        } else {
          alert('Yedek yükleme başarısız oldu: ' + res.error);
        }
      };
      reader.readAsText(file);
    });
  }
}

/* ==========================================================================
   16. Yardımcı Fonksiyonlar & Modal Tetikleyicileri
   ========================================================================== */
function openAddStudentModal() {
  document.getElementById('st-form-title').textContent = 'Yeni Öğrenci Ekle';
  document.getElementById('form-student-full').reset();
  document.getElementById('st-form-id').value = '';
  openModal('modal-student-full');
}

function openEditCurrentStudentModal() {
  if (!state.currentStudent) return;
  const st = state.currentStudent;
  document.getElementById('st-form-title').textContent = 'Öğrenci Bilgilerini Düzenle';
  document.getElementById('st-form-id').value = st.id;
  document.getElementById('st-form-no').value = st.studentNo || '';
  document.getElementById('st-form-name').value = st.name || '';
  document.getElementById('st-form-phone').value = st.phone || '';
  document.getElementById('st-form-address').value = st.address || '';
  document.getElementById('st-form-chronic').value = (st.chronicIllness === true || st.chronicIllness === 'true') ? 'true' : 'false';
  document.getElementById('st-form-illness-detail').value = st.illnessDetail || '';
  document.getElementById('st-form-emergency').value = st.emergencyAction || '';
  document.getElementById('st-form-parents-together').value = st.parentsTogether || 'Birlikte';
  document.getElementById('st-form-sibling').value = st.siblingCount || '';
  document.getElementById('st-form-mother-name').value = st.motherName || '';
  document.getElementById('st-form-mother-phone').value = st.motherPhone || '';
  document.getElementById('st-form-mother-job').value = st.motherJob || '';
  document.getElementById('st-form-mother-alive').value = st.motherAlive || 'Sağ';
  document.getElementById('st-form-father-name').value = st.fatherName || '';
  document.getElementById('st-form-father-phone').value = st.fatherPhone || '';
  document.getElementById('st-form-father-job').value = st.fatherJob || '';
  document.getElementById('st-form-father-alive').value = st.fatherAlive || 'Sağ';
  document.getElementById('st-form-guardian').value = st.primaryGuardian || 'Anne';

  openModal('modal-student-full');
}

async function deleteCurrentStudent() {
  if (!state.currentStudent) return;
  if (confirm(`${state.currentStudent.name} adlı öğrenciyi ve tüm kayıtlarını silmek istediğinize emin misiniz?`)) {
    await window.db.deleteStudent(state.currentStudent.id);
    alert('Öğrenci silindi.');
    if (state.currentClass) {
      await openClassDetail(state.currentClass.id);
    } else {
      await renderHome();
    }
  }
}

async function resetAllData() {
  const confirmed = confirm("⚠️ DİKKAT:\nUygulamadaki tüm sınıflar, öğrenciler ve kayıtlar kalıcı olarak silinecektir.\n\nSıfırdan temiz bir başlangıç yapmak istediğinize emin misiniz?");
  if (confirmed) {
    const tx = window.db.db.transaction(['classes', 'students', 'notes'], 'readwrite');
    tx.objectStore('classes').clear();
    tx.objectStore('students').clear();
    tx.objectStore('notes').clear();
    tx.oncomplete = async () => {
      alert("Tüm sınıflar ve öğrenciler temizlendi. Artık sıfırdan başlayabilirsiniz.");
      closeModal('modal-settings');
      state.currentClass = null;
      state.currentStudent = null;
      await renderHome();
    };
  }
}

/* ==========================================================================
   17. OCR / Sınıf Defteri Fotoğraftan Tarama Mantığı
   ========================================================================== */
function openOcrModal() {
  document.getElementById('ocr-progress-wrap').style.display = 'none';
  document.getElementById('ocr-results-wrap').style.display = 'none';
  document.getElementById('ocr-save-btn').style.display = 'none';
  document.getElementById('ocr-table-body').innerHTML = '';
  document.getElementById('ocr-camera-input').value = '';
  document.getElementById('ocr-gallery-input').value = '';
  openModal('modal-ocr-scan');
}

function setupOcrListeners() {
  const cameraInput = document.getElementById('ocr-camera-input');
  const galleryInput = document.getElementById('ocr-gallery-input');

  const handleOcrFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const progressWrap = document.getElementById('ocr-progress-wrap');
    const progressBar = document.getElementById('ocr-progress-bar');
    const statusText = document.getElementById('ocr-status-text');
    const resultsWrap = document.getElementById('ocr-results-wrap');
    const saveBtn = document.getElementById('ocr-save-btn');

    progressWrap.style.display = 'block';
    resultsWrap.style.display = 'none';
    saveBtn.style.display = 'none';
    progressBar.style.width = '10%';
    statusText.textContent = '📸 Fotoğraf netleştiriliyor...';

    try {
      // 1. Görüntüyü kontrast ve gri tonlamayla hazırla
      const processedCanvas = await window.ocrService.preprocessImage(file);
      progressBar.style.width = '25%';
      statusText.textContent = '🔍 Yapay Zeka isimleri ve numaraları okuyor...';

      // 2. OCR taraması yap
      const students = await window.ocrService.scanNotebookPhoto(processedCanvas, (p) => {
        const pct = Math.round(p.progress * 100);
        progressBar.style.width = `${pct}%`;
        statusText.textContent = `${p.status} (%${pct})`;
      });

      progressWrap.style.display = 'none';

      if (!students || students.length === 0) {
        alert('Fotoğrafta öğrenci numarası veya ismi tespit edilemedi. Lütfen daha aydınlık bir ortamda, yazılar düz olacak şekilde tekrar çekiniz veya elle ekleyiniz.');
        return;
      }

      // 3. Tabloya dök
      renderOcrEditableTable(students);

    } catch (err) {
      console.error('OCR hatası:', err);
      progressWrap.style.display = 'none';
      alert('Fotoğraf taranırken bir sorun oluştu: ' + (err.message || 'Lütfen tekrar deneyiniz.'));
    }
  };

  if (cameraInput) cameraInput.addEventListener('change', handleOcrFile);
  if (galleryInput) galleryInput.addEventListener('change', handleOcrFile);
}

function renderOcrEditableTable(students) {
  const tbody = document.getElementById('ocr-table-body');
  const countInfo = document.getElementById('ocr-count-info');
  const resultsWrap = document.getElementById('ocr-results-wrap');
  const saveBtn = document.getElementById('ocr-save-btn');

  tbody.innerHTML = '';
  countInfo.textContent = `✅ ${students.length} Öğrenci Okundu`;

  students.forEach((st, idx) => {
    const tr = document.createElement('tr');
    tr.id = `ocr-row-${idx}`;
    tr.innerHTML = `
      <td>
        <input type="number" class="ocr-input-no" value="${st.studentNo || ''}" placeholder="No">
      </td>
      <td>
        <input type="text" class="ocr-input-name" value="${st.name || ''}" placeholder="Öğrenci Adı Soyadı">
      </td>
      <td style="text-align: center;">
        <button type="button" class="ocr-del-row-btn" onclick="this.closest('tr').remove(); updateOcrCount();" title="Satırı Sil">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  resultsWrap.style.display = 'block';
  saveBtn.style.display = 'inline-flex';
}

function addOcrBlankRow() {
  const tbody = document.getElementById('ocr-table-body');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <input type="number" class="ocr-input-no" value="" placeholder="No">
    </td>
    <td>
      <input type="text" class="ocr-input-name" value="" placeholder="Öğrenci Adı Soyadı">
    </td>
    <td style="text-align: center;">
      <button type="button" class="ocr-del-row-btn" onclick="this.closest('tr').remove(); updateOcrCount();">✕</button>
    </td>
  `;
  tbody.appendChild(tr);
  updateOcrCount();
}

function updateOcrCount() {
  const rows = document.querySelectorAll('#ocr-table-body tr');
  const countInfo = document.getElementById('ocr-count-info');
  if (countInfo) {
    countInfo.textContent = `✅ ${rows.length} Öğrenci Bulundu`;
  }
}

async function saveOcrStudents() {
  if (!state.currentClass) return;

  const rows = document.querySelectorAll('#ocr-table-body tr');
  let savedCount = 0;

  for (const row of rows) {
    const no = row.querySelector('.ocr-input-no').value.trim();
    const name = row.querySelector('.ocr-input-name').value.trim();

    if (name) {
      await window.db.saveStudent({
        classId: state.currentClass.id,
        studentNo: no || '',
        name: name
      });
      savedCount++;
    }
  }

  if (savedCount > 0) {
    closeModal('modal-ocr-scan');
    await renderClassStudents();
    alert(`🎉 Harika! ${savedCount} öğrenci "${state.currentClass.name}" sınıfına başarıyla eklendi!`);
  } else {
    alert('Kaydedilecek geçerli bir öğrenci satırı bulunamadı.');
  }
}

window.openOcrModal = openOcrModal;
window.addOcrBlankRow = addOcrBlankRow;
window.updateOcrCount = updateOcrCount;
window.saveOcrStudents = saveOcrStudents;
window.applyTheme = applyTheme;
window.toggleThemeNext = toggleThemeNext;
window.resetAllData = resetAllData;
window.openClassDetail = openClassDetail;
window.openEditClassModal = openEditClassModal;
window.deleteCurrentClass = deleteCurrentClass;
window.openStudentDetail = openStudentDetail;
window.openAddStudentModal = openAddStudentModal;
window.openEditCurrentStudentModal = openEditCurrentStudentModal;
window.deleteCurrentStudent = deleteCurrentStudent;
window.openInlineEditModal = openInlineEditModal;
window.openContactActionModal = openContactActionModal;
window.sendWhatsAppTemplate = sendWhatsAppTemplate;
window.openOfficialReportModal = openOfficialReportModal;
window.openModal = openModal;
window.closeModal = closeModal;
