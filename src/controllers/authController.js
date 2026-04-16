const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

// 1.1 Registrasi Brand
const registerBrand = async (req, res) => {
  try {
    const { email, password, nama_perusahaan, pic_name, phone_number } = req.body;

    if (!email || !password || !nama_perusahaan || !pic_name) {
      return res.status(400).json({ message: 'Email, password, nama perusahaan, dan PIC wajib diisi' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert([{ 
        email, 
        password_hash: passwordHash, 
        role: 'BRAND', 
        status: 'ACTIVE' 
      }])
      .select('id')
      .single();

    if (userError) throw userError;

    const { data: newBrand, error: brandError } = await supabase
      .from('brands')
      .insert([{
        user_id: newUser.id,
        nama_perusahaan,
        pic_name,
        phone_number: phone_number || ''
      }])
      .select('id')
      .single();

    if (brandError) throw brandError;

    res.status(201).json({
      status: "success",
      message: "Registrasi Brand berhasil",
      data: {
        user_id: newUser.id,
        brand_id: newBrand.id
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// 1.2 Registrasi Creator
const registerCreator = async (req, res) => {
  try {
    const { email, password, nama_lengkap } = req.body;

    if (!email || !password || !nama_lengkap) {
      return res.status(400).json({ message: 'Email, password, dan nama lengkap wajib diisi' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert([{ 
        email, 
        password_hash: passwordHash, 
        role: 'CREATOR', 
        status: 'ACTIVE' 
      }])
      .select('id')
      .single();

    if (userError) throw userError;

    const { data: newCreator, error: creatorError } = await supabase
      .from('creators')
      .insert([{
        user_id: newUser.id,
        nama_lengkap,
        kyc_status: 'UNVERIFIED'
      }])
      .select('id')
      .single();

    if (creatorError) throw creatorError;

    await supabase.from('wallets').insert([{ creator_id: newCreator.id }]);

    res.status(201).json({
      status: "success",
      message: "Registrasi Creator berhasil",
      data: {
        user_id: newUser.id,
        creator_id: newCreator.id
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// 1.3 Login User
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email dan password wajib diisi' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    // Generate Access Token (Expires in 15 minutes / 900 seconds)
    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'secret_key_promme',
      { expiresIn: '15m' }
    );

    // Generate Refresh Token (Longer lived, e.g., 7 days)
    const refreshToken = crypto.randomBytes(40).toString('hex');

    // Update last login
    await supabase.from('users').update({ last_login_at: new Date() }).eq('id', user.id);

    res.status(200).json({
      status: "success",
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        role: user.role,
        expires_in: 900
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan server' });
  }
};

module.exports = { registerBrand, registerCreator, login };