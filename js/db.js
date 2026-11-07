/**
 * db.js - IndexedDB Yerel Veritabanı Yöneticisi
 * Veriler %100 kullanıcının kendi cihazında saklanır, harici sunucuya gitmez.
 * Geliştirici: Fatih PATIR (https://fatihpatir.github.io/web)
 */

const DB_NAME = 'OgretmenRehberlikDB';
const DB_VERSION = 2;

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Sınıflar tablosu
        if (!db.objectStoreNames.contains('classes')) {
          const classStore = db.createObjectStore('classes', { keyPath: 'id' });
          classStore.createIndex('name', 'name', { unique: true });
        }

        // Öğrenciler tablosu
        if (!db.objectStoreNames.contains('students')) {
          const studentStore = db.createObjectStore('students', { keyPath: 'id' });
          studentStore.createIndex('classId', 'classId', { unique: false });
          studentStore.createIndex('studentNo', 'studentNo', { unique: false });
          studentStore.createIndex('name', 'name', { unique: false });
        }

        // Görüşme & Rehberlik Notları tablosu
        if (!db.objectStoreNames.contains('notes')) {
          const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
          noteStore.createIndex('studentId', 'studentId', { unique: false });
        }

        // Ayarlar & Kullanıcı Bilgisi
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = async (e) => {
        this.db = e.target.result;
        await this.seedDefaultsIfNeeded();
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('IndexedDB hatası:', e.target.error);
        reject(e.target.error);
      };
    });
  }

  // Başlangıç varsayılan ayarları (Sınıflar boş gelir, öğretmen kendisi ekler)
  async seedDefaultsIfNeeded() {
    let teacherName = await this.getSetting('teacherName');
    if (!teacherName) {
      teacherName = 'Fatih PATIR';
      await this.setSetting('teacherName', teacherName);
    }

    let schoolName = await this.getSetting('schoolName');
    if (!schoolName || schoolName === 'Rehberlik Servisi') {
      schoolName = 'Nene Hatun Kız MTAL';
      await this.setSetting('schoolName', schoolName);
    }

    let websiteUrl = await this.getSetting('websiteUrl');
    if (!websiteUrl) {
      await this.setSetting('websiteUrl', 'https://fatihpatir.github.io/web');
    }
  }

  /* --- Sınıf İşlemleri --- */
  async getAllClasses() {
    return new Promise((resolve) => {
      const tx = this.db.transaction('classes', 'readonly');
      const store = tx.objectStore('classes');
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  }

  async getClass(id) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('classes', 'readonly');
      const store = tx.objectStore('classes');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async addClass(classObj) {
    if (!classObj.id) {
      classObj.id = 'cls_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    }
    classObj.name = classObj.name.trim().toUpperCase();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('classes', 'readwrite');
      const store = tx.objectStore('classes');
      const req = store.put(classObj);
      req.onsuccess = () => resolve(classObj);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async updateClassName(id, newName) {
    const cls = await this.getClass(id);
    if (!cls) return null;
    cls.name = newName.trim().toUpperCase();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('classes', 'readwrite');
      const store = tx.objectStore('classes');
      const req = store.put(cls);
      req.onsuccess = () => resolve(cls);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async deleteClass(id) {
    // Sınıfı ve sınıftaki tüm öğrencileri sil
    const students = await this.getStudentsByClass(id);
    for (const st of students) {
      await this.deleteStudent(st.id);
    }
    return new Promise((resolve) => {
      const tx = this.db.transaction('classes', 'readwrite');
      const store = tx.objectStore('classes');
      store.delete(id);
      tx.oncomplete = () => resolve(true);
    });
  }

  /* --- Öğrenci İşlemleri --- */
  async getAllStudents() {
    return new Promise((resolve) => {
      const tx = this.db.transaction('students', 'readonly');
      const store = tx.objectStore('students');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async getStudentsByClass(classId) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('students', 'readonly');
      const store = tx.objectStore('students');
      const index = store.index('classId');
      const req = index.getAll(classId);
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => {
          const noA = parseInt(a.studentNo, 10) || 0;
          const noB = parseInt(b.studentNo, 10) || 0;
          if (noA !== noB) return noA - noB;
          return a.name.localeCompare(b.name, 'tr');
        });
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  }

  async getStudent(id) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('students', 'readonly');
      const store = tx.objectStore('students');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async saveStudent(student) {
    if (!student.id) {
      student.id = 'st_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      student.createdAt = Date.now();
    }
    student.updatedAt = Date.now();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('students', 'readwrite');
      const store = tx.objectStore('students');
      const req = store.put(student);
      req.onsuccess = () => resolve(student);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async updateStudentField(studentId, fieldName, value) {
    const student = await this.getStudent(studentId);
    if (!student) return null;
    student[fieldName] = value;
    student.updatedAt = Date.now();
    return await this.saveStudent(student);
  }

  async deleteStudent(id) {
    const notes = await this.getNotesByStudent(id);
    for (const n of notes) {
      await this.deleteNote(n.id);
    }
    return new Promise((resolve) => {
      const tx = this.db.transaction('students', 'readwrite');
      const store = tx.objectStore('students');
      store.delete(id);
      tx.oncomplete = () => resolve(true);
    });
  }

  /* --- Arama & Filtreleme --- */
  async searchStudents(keyword) {
    if (!keyword || keyword.trim().length === 0) return [];
    const term = keyword.trim().toLowerCase();
    const all = await this.getAllStudents();
    return all.filter((s) => {
      const nameMatch = s.name && s.name.toLowerCase().includes(term);
      const noMatch = s.studentNo && String(s.studentNo).includes(term);
      return nameMatch || noMatch;
    });
  }

  async getChronicIllStudents() {
    const all = await this.getAllStudents();
    return all.filter((s) => s.chronicIllness === true || s.chronicIllness === 'true');
  }

  /* --- Görüşme & Rehberlik Notları --- */
  async getNotesByStudent(studentId) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('notes', 'readonly');
      const store = tx.objectStore('notes');
      const index = store.index('studentId');
      const req = index.getAll(studentId);
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => (b.date || 0) - (a.date || 0));
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  }

  async addNote(note) {
    if (!note.id) {
      note.id = 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    }
    if (!note.date) {
      note.date = Date.now();
    }
    return new Promise((resolve) => {
      const tx = this.db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      store.put(note);
      tx.oncomplete = () => resolve(note);
    });
  }

  async deleteNote(id) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      store.delete(id);
      tx.oncomplete = () => resolve(true);
    });
  }

  /* --- Ayarlar --- */
  async getSetting(key) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => resolve(null);
    });
  }

  async setSetting(key, value) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      store.put({ key, value });
      tx.oncomplete = () => resolve(true);
    });
  }

  /* --- Yedekleme & Geri Yükleme --- */
  async exportBackup() {
    const classes = await this.getAllClasses();
    const students = await this.getAllStudents();
    const notesPromise = new Promise((resolve) => {
      const tx = this.db.transaction('notes', 'readonly');
      const req = tx.objectStore('notes').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    const notes = await notesPromise;
    const teacherName = await this.getSetting('teacherName') || 'Fatih PATIR';
    const websiteUrl = await this.getSetting('websiteUrl') || 'https://fatihpatir.github.io/web';
    const schoolName = await this.getSetting('schoolName') || 'Nene Hatun Kız MTAL';

    const backupData = {
      version: 1,
      appName: 'OgretmenRehberlik',
      exportedAt: new Date().toISOString(),
      settings: { teacherName, websiteUrl, schoolName },
      classes,
      students,
      notes
    };

    return JSON.stringify(backupData, null, 2);
  }

  async importBackup(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      if (!data.classes || !data.students) {
        throw new Error('Geçersiz yedek dosyası yapısı.');
      }

      for (const cls of data.classes) {
        await this.addClass(cls);
      }
      for (const st of data.students) {
        await this.saveStudent(st);
      }
      if (data.notes) {
        for (const n of data.notes) {
          await this.addNote(n);
        }
      }
      if (data.settings) {
        if (data.settings.teacherName) await this.setSetting('teacherName', data.settings.teacherName);
        if (data.settings.websiteUrl) await this.setSetting('websiteUrl', data.settings.websiteUrl);
        if (data.settings.schoolName) await this.setSetting('schoolName', data.settings.schoolName);
      }

      return { success: true, count: data.students.length };
    } catch (err) {
      console.error('Yedek yükleme hatası:', err);
      return { success: false, error: err.message };
    }
  }
}

// Global instance
window.db = new Database();
