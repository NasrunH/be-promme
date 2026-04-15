const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Fungsi Registrasi (Versi Sebelumnya)
const register = async (req, res) => {
  try {
    const { email, password, role, name, phone_number, pic_name } = req.body;

    if (!email || !password || !role || !name) {
      return res.status(400).json({ message: 'Email, password, role, dan nama wajib diisi' });
    }

    if (!['BRAND', 'CREATOR'].includes(role)) {
      return res.status(400).json({ message: 'Role harus BRAND atau CREATOR' });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ message: 'Email sudah digunakan' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert([
        { 
          email, 
          password_hash: passwordHash, 
          role,
          status: 'ACTIVE'
        }
      ])
      .select()
      .single();

    if (userError) throw userError;

    const userId = newUser.id;

    if (role === 'BRAND') {
      const { error: brandError } = await supabase
        .from('brands')
        .insert([
          {
            user_id: userId,
            nama_perusahaan: name,
            pic_name: pic_name || name,
            phone_number: phone_number || ''
          }
        ]);
      if (brandError) throw brandError;
    } else if (role === 'CREATOR') {
      const { error: creatorError } = await supabase
        .from('creators')
        .insert([{ user_id: userId, nama_lengkap: name, kyc_status: 'UNVERIFIED' }]);
        
      await supabase.from('wallets').insert([{ creator_id: userId }]);
      
      if (creatorError) throw creatorError;
    }

    res.status(201).json({
      status: 'success',
      message: 'Registrasi berhasil',
      data: { id: userId, email: newUser.email, role: newUser.role }
    });

  } catch (error) {
    console.error('Register Error:', error);
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan server' });
  }
};

// Fungsi Login (Baru)
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email dan password wajib diisi' });
    }

    // 1. Cari user berdasarkan email
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    // 2. Verifikasi Password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    // 3. Buat JWT Token
    const payload = {
      id: user.id,
      role: user.role,
      status: user.status
    };

    const token = jwt.sign(
      payload, 
      process.env.JWT_SECRET || 'secret_key_promme', 
      { expiresIn: '1d' } // Token berlaku 1 hari
    );

    // 4. Update last_login_at (optional)
    await supabase.from('users').update({ last_login_at: new Date() }).eq('id', user.id);

    res.json({
      status: 'success',
      message: 'Login berhasil',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan server' });
  }
};

module.exports = { register, login };