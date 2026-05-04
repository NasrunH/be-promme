// Validation utilities for profile forms

const validateBrandProfile = (data) => {
  const errors = {};

  if (!data.nama_perusahaan || data.nama_perusahaan.trim().length < 2) {
    errors.nama_perusahaan = 'Nama perusahaan minimal 2 karakter';
  }

  if (!data.pic_name || data.pic_name.trim().length < 2) {
    errors.pic_name = 'Nama PIC minimal 2 karakter';
  }

  if (!data.phone_number) {
    errors.phone_number = 'Nomor telepon wajib diisi';
  } else if (!/^(\+62|62|0)[0-9]{9,12}$/.test(data.phone_number.replace(/[-\s]/g, ''))) {
    errors.phone_number = 'Format nomor telepon tidak valid';
  }

  if (data.website && !isValidUrl(data.website)) {
    errors.website = 'Format website tidak valid';
  }

  if (data.tahun_berdiri) {
    const currentYear = new Date().getFullYear();
    const year = parseInt(data.tahun_berdiri);
    if (isNaN(year) || year < 1900 || year > currentYear) {
      errors.tahun_berdiri = `Tahun berdiri harus antara 1900 dan ${currentYear}`;
    }
  }

  if (data.kode_pos && !/^[0-9]{5}$/.test(data.kode_pos)) {
    errors.kode_pos = 'Kode pos harus 5 digit angka';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

const validateCreatorProfile = (data) => {
  const errors = {};

  if (!data.nama_lengkap || data.nama_lengkap.trim().length < 2) {
    errors.nama_lengkap = 'Nama lengkap minimal 2 karakter';
  }

  if (data.bio && data.bio.length > 500) {
    errors.bio = 'Bio maksimal 500 karakter';
  }

  if (data.tanggal_lahir) {
    const birthDate = new Date(data.tanggal_lahir);
    const today = new Date();
    const minAge = 13;
    const maxAge = 100;
    
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      birthDate.setFullYear(birthDate.getFullYear() + 1);
    }
    
    const finalAge = today.getFullYear() - birthDate.getFullYear();
    
    if (finalAge < minAge || finalAge > maxAge) {
      errors.tanggal_lahir = `Usia harus antara ${minAge} dan ${maxAge} tahun`;
    }
  }

  if (data.kode_pos && !/^[0-9]{5}$/.test(data.kode_pos)) {
    errors.kode_pos = 'Kode pos harus 5 digit angka';
  }

  if (!data.bahasa || data.bahasa.length === 0) {
    errors.bahasa = 'Pilih minimal satu bahasa';
  }

  if (!data.kategori_niche || data.kategori_niche.length === 0) {
    errors.kategori_niche = 'Pilih minimal satu kategori niche';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

const validateKYC = (data) => {
  const errors = {};

  if (!data.nik) {
    errors.nik = 'NIK wajib diisi';
  } else if (!/^[0-9]{16}$/.test(data.nik)) {
    errors.nik = 'NIK harus 16 digit angka';
  }

  if (data.npwp && !/^[0-9]{15}$/.test(data.npwp)) {
    errors.npwp = 'NPWP harus 15 digit angka';
  }

  if (!data.ktp_image) {
    errors.ktp_image = 'Foto KTP wajib diunggah';
  }

  if (!data.selfie_image) {
    errors.selfie_image = 'Foto selfie wajib diunggah';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

const validatePasswordChange = (data) => {
  const errors = {};

  if (!data.old_password) {
    errors.old_password = 'Password lama wajib diisi';
  }

  if (!data.new_password) {
    errors.new_password = 'Password baru wajib diisi';
  } else if (data.new_password.length < 8) {
    errors.new_password = 'Password baru minimal 8 karakter';
  }

  if (!data.confirm_password) {
    errors.confirm_password = 'Konfirmasi password wajib diisi';
  } else if (data.new_password !== data.confirm_password) {
    errors.confirm_password = 'Konfirmasi password tidak cocok';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  return phone.replace(/[-\s]/g, '');
};

const formatWebsite = (website) => {
  if (!website) return '';
  if (!website.startsWith('http://') && !website.startsWith('https://')) {
    return 'https://' + website;
  }
  return website;
};

module.exports = {
  validateBrandProfile,
  validateCreatorProfile,
  validateKYC,
  validatePasswordChange,
  isValidUrl,
  formatPhoneNumber,
  formatWebsite
};