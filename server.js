const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Подключение к MongoDB с обработкой ошибок
mongoose.connect('mongodb://localhost:27017/student_rating', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ Connected to MongoDB');
}).catch(err => {
    console.log('❌ MongoDB connection error:', err);
});

// Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false
}));

// Настройка EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Настройка загрузки файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

// Импорт маршрутов
const authRoutes = require('./src/routes/auth');

// Использование маршрутов
app.use('/auth', authRoutes);

// Импорт моделей
const User = require('./src/models/User');
const News = require('./src/models/News');

// Основные маршруты
app.get('/', async (req, res) => {
    try {
        // Временные данные для теста
        const topStudents = [
            { fullName: 'Иванов Иван', group: 'ИСИП-20', rating: 95 },
            { fullName: 'Савенкова Алина', group: 'ИСИП-20', rating: 99 },
            { fullName: 'Лазарев Алексей', group: 'ИСИП-20', rating: 76 }
        ];

        const latestNews = [
            { 
                _id: '1',
                title: 'Добро пожаловать!', 
                content: 'Система рейтинга учащихся запущена' 
            },
            { 
                _id: '2',
                title: 'Новые достижения', 
                content: 'Студенты получили награды' 
            }
        ];

        res.render('index', { 
            user: req.session.user, 
            topStudents, 
            latestNews 
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Ошибка сервера');
    }
});

// Тестовый маршрут
app.get('/test', (req, res) => {
    res.send('✅ Сервер работает корректно!');
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📊 Тестовая страница: http://localhost:${PORT}/test`);
    console.log(`🔐 Регистрация: http://localhost:${PORT}/auth/register`);
    console.log(`🔒 Вход: http://localhost:${PORT}/auth/login`);
});

module.exports = app;