const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Helper to handle user deletion on failure (Manual Rollback)
const rollbackUser = async (userId) => {
  await supabase.from('users').delete().eq('id', userId);
};

// Helper for Profile Image Upload
const uploadProfileImage = async (file, userId) => {
  const fileExtension = file.originalname.split('.').pop();
  const fileName = `profiles/${userId}_${Date.now()}.${fileExtension}`;

  const { data, error } = await supabase.storage
    .from('kyc-documents') // Reuse existing bucket or use a specific one
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true
    });

  if (error) throw error;

  const { data: publicUrlData } = supabase.storage
    .from('kyc-documents')
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
};

// 1. REGISTRASI BRAND
const registerBrand = async (req, res) => {
  let userId = null;
  try {
    const { email, password, nama_perusahaan, pic_name, phone_number } = req.body;

    if (!email || !password || !nama_perusahaan || !pic_name) {
      return res.status(400).json({ status: 'error', message: 'Email, password, nama perusahaan, dan PIC wajib diisi' });
    }

    // Hash Password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert to Users
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{ email, password_hash: passwordHash, role: 'BRAND' }])
      .select().single();

    if (userError) return res.status(400).json({ status: 'error', message: 'Email sudah digunakan atau database error' });
    userId = user.id;

    // Insert to Brands
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .insert([{ 
        user_id: userId, 
        nama_perusahaan, 
        pic_name, 
        phone_number 
      }])
      .select().single();

    if (brandError) {
      await rollbackUser(userId);
      throw brandError;
    }

    res.status(201).json({
      status: 'success',
      message: 'Registrasi Brand berhasil',
      data: {
        user_id: userId,
        brand_id: brand.id
      }
    });

  } catch (error) {
    if (userId) await rollbackUser(userId);
    console.error('Register Brand Error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// 2. REGISTRASI CREATOR
const registerCreator = async (req, res) => {
  let userId = null;
  try {
    const { email, password, nama_lengkap } = req.body;

    if (!email || !password || !nama_lengkap) {
      return res.status(400).json({ status: 'error', message: 'Email, password, dan nama lengkap wajib diisi' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{ email, password_hash: passwordHash, role: 'CREATOR' }])
      .select().single();

    if (userError) return res.status(400).json({ status: 'error', message: 'Email sudah digunakan' });
    userId = user.id;

    // Insert to Creators
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .insert([{ user_id: userId, nama_lengkap }])
      .select().single();

    if (creatorError) {
      await rollbackUser(userId);
      throw creatorError;
    }

    // Insert to Wallets (FIX: Use creator.id, NOT userId)
    const { error: walletError } = await supabase
      .from('wallets')
      .insert([{ creator_id: creator.id }]);

    if (walletError) {
      // In complex systems, we might want to delete creator too, but let's keep it simple
      await supabase.from('creators').delete().eq('id', creator.id);
      await rollbackUser(userId);
      throw walletError;
    }

    res.status(201).json({
      status: 'success',
      message: 'Registrasi Creator berhasil',
      data: {
        user_id: userId,
        creator_id: creator.id
      }
    });

  } catch (error) {
    if (userId) await rollbackUser(userId);
    console.error('Register Creator Error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// 3. LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ status: 'error', message: 'Email atau password salah' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Email atau password salah' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role }, 
      process.env.JWT_SECRET || 'secret_key_promme', 
      { expiresIn: '1d' }
    );

    await supabase.from('users').update({ last_login_at: new Date() }).eq('id', user.id);

    res.json({
      status: 'success',
      data: {
        access_token: token,
        refresh_token: "dummy_refresh_token", // In real apps, implement refresh token logic
        role: user.role,
        expires_in: 86400
      }
    });

  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// 4. UBAH PASSWORD
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { old_password, new_password } = req.body;

    if (!old_password || !new_password) {
      return res.status(400).json({ status: 'error', message: 'Password lama dan password baru wajib diisi' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
    }

    const isMatch = await bcrypt.compare(old_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ status: 'error', message: 'Password lama salah' });
    }

    const newPasswordHash = await bcrypt.hash(new_password, 10);

    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newPasswordHash })
      .eq('id', userId);

    if (updateError) throw updateError;

    res.status(200).json({ status: 'success', message: 'Password berhasil diubah' });

  } catch (error) {
    console.error('Change Password Error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal merubah password' });
  }
};

// 5. GET CURRENT USER INFO
const getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, status, nama_lengkap, profile_picture_url, created_at')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
    }

    let unifiedData = {
      ...user,
      display_name: user.nama_lengkap || user.email.split('@')[0],
      display_picture: user.profile_picture_url
    };

    // If role is CREATOR or BRAND, fetch additional data
    console.log(`[getMe] Role: ${user.role}, UserID: ${userId}`);
    if (user.role === 'CREATOR') {
      const { data: creator, error: cErr } = await supabase
        .from('creators')
        .select('nama_lengkap, profile_picture_url')
        .eq('user_id', userId)
        .single();
      
      console.log(`[getMe] Creator Data:`, creator, cErr);
      if (creator) {
        unifiedData.display_name = creator.nama_lengkap || unifiedData.display_name;
        unifiedData.display_picture = creator.profile_picture_url || unifiedData.display_picture;
      }
    } else if (user.role === 'BRAND') {
      const { data: brand, error: bErr } = await supabase
        .from('brands')
        .select('nama_perusahaan, logo_url')
        .eq('user_id', userId)
        .single();
      
      console.log(`[getMe] Brand Data:`, brand, bErr);
      if (brand) {
        unifiedData.display_name = brand.nama_perusahaan || unifiedData.display_name;
        unifiedData.display_picture = brand.logo_url || unifiedData.display_picture;
      }
    }
    console.log(`[getMe] Final Unified Data:`, unifiedData.display_name);

    res.json({ status: 'success', data: unifiedData });
  } catch (error) {
    console.error('getMe Error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// 6. UPDATE PROFILE (FOR ADMIN/FINANCE)
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { nama_lengkap } = req.body;
    let profile_picture_url = req.body.profile_picture_url;

    if (req.file) {
      profile_picture_url = await uploadProfileImage(req.file, userId);
    }

    const updateData = {};
    if (nama_lengkap !== undefined) updateData.nama_lengkap = nama_lengkap;
    if (profile_picture_url !== undefined) updateData.profile_picture_url = profile_picture_url;

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('id, email, role, nama_lengkap, profile_picture_url')
      .single();

    if (error) throw error;

    res.json({
      status: 'success',
      message: 'Profil berhasil diperbarui',
      data: user
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Gagal memperbarui profil' });
  }
};

module.exports = { registerBrand, registerCreator, login, changePassword, getMe, updateProfile };