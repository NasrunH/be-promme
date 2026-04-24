const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Helper to handle user deletion on failure (Manual Rollback)
const rollbackUser = async (userId) => {
  await supabase.from('users').delete().eq('id', userId);
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

module.exports = { registerBrand, registerCreator, login };