const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const router = express.Router();

// Страница регистрации
router.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/profile');
    }
    res.render('register', { error: null, formData: {} });
});

// Страница входа
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/profile');
    }
    res.render('login', { error: null, email: '' });
});

// Обработка регистрации
router.post('/register', async (req, res) => {
    try {
        const { fullName, phone, group, email, password, confirmPassword } = req.body;

        // Валидация
        if (password !== confirmPassword) {
            return res.render('register', {
                error: 'Пароли не совпадают',
                formData: { fullName, phone, group, email }
            });
        }

        if (password.length < 6) {
            return res.render('register', {
                error: 'Пароль должен содержать минимум 6 символов',
                formData: { fullName, phone, group, email }
            });
        }

        // Проверка существующего пользователя
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('register', {
                error: 'Пользователь с таким email уже существует',
                formData: { fullName, phone, group, email }
            });
        }

        // Создание пользователя
        const newUser = new User({
            fullName,
            phone,
            group,
            email,
            password,
            role: 'student'
        });

        await newUser.save();

        // Автоматический вход после регистрации
        req.session.user = {
            _id: newUser._id,
            fullName: newUser.fullName,
            email: newUser.email,
            role: newUser.role,
            group: newUser.group
        };

        res.redirect('/profile');

    } catch (error) {
        console.error('Registration error:', error);
        res.render('register', {
            error: 'Ошибка при регистрации',
            formData: req.body
        });
    }
});

// Обработка входа
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Находим пользователя с паролем
        const user = await User.findOne({ email }).select('+password');
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.render('login', {
                error: 'Неверный email или пароль',
                email
            });
        }

        if (!user.isActive) {
            return res.render('login', {
                error: 'Аккаунт заблокирован',
                email
            });
        }

        // Сохраняем в сессию
        req.session.user = {
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            group: user.group,
            rating: user.rating
        };

        res.redirect('/profile');

    } catch (error) {
        console.error('Login error:', error);
        res.render('login', {
            error: 'Ошибка при входе',
            email: req.body.email
        });
    }
});

// Выход
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
});

module.exports = router;