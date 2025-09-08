const express = require('express');
const session = require('express-session');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const multer = require('multer');

const app = express();
const PORT = 3000;

// Настройка multer для загрузки файлов
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
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Подключение к базе данных
const db = new sqlite3.Database('./database/student_rating.db', (err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err);
    } else {
        console.log('✅ Подключение к SQLite базе данных установлено');
    }
});

// Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false
}));

// Настройка EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware для проверки админских прав
const requireAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).send('Доступ запрещен');
    }
};

// Маршруты
app.get('/', (req, res) => {
    // Получаем топ студентов
    db.all(`SELECT id, fullName, groupName, rating FROM users WHERE role = 'student' ORDER BY rating DESC LIMIT 10`, 
        (err, topStudents) => {
            if (err) {
                console.error('Ошибка получения студентов:', err);
                topStudents = [];
            }

            // Получаем последние новости
            db.all(`SELECT n.*, u.fullName as authorName 
                   FROM news n 
                   JOIN users u ON n.authorId = u.id 
                   ORDER BY n.createdAt DESC LIMIT 5`, 
                (err, latestNews) => {
                    if (err) {
                        console.error('Ошибка получения новостей:', err);
                        latestNews = [];
                    }

                    res.render('index', {
                        user: req.session.user,
                        topStudents,
                        latestNews
                    });
                });
        });
});

app.get('/auth/login', (req, res) => {
    if (req.session.user) return res.redirect('/profile');
    res.render('login', { error: null, email: '' });
});

app.post('/auth/login', (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err) {
            return res.render('login', { error: 'Ошибка сервера', email });
        }

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.render('login', { error: 'Неверный email или пароль', email });
        }

        req.session.user = {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            group: user.groupName,
            rating: user.rating
        };

        res.redirect('/profile');
    });
});

app.get('/profile', (req, res) => {
    if (!req.session.user) return res.redirect('/auth/login');

    // Получаем достижения пользователя
    db.all(`SELECT * FROM achievements WHERE studentId = ? ORDER BY createdAt DESC`, 
        [req.session.user.id], (err, achievements) => {
            if (err) {
                console.error('Ошибка получения достижений:', err);
                achievements = [];
            }

            // Рассчитываем место в рейтинге
            db.all(`SELECT id, rating FROM users WHERE role = 'student' ORDER BY rating DESC`, 
                (err, allStudents) => {
                    const rank = allStudents.findIndex(s => s.id === req.session.user.id) + 1;

                    res.render('profile', {
                        user: req.session.user,
                        achievements,
                        rank: rank || '—'
                    });
                });
        });
});

// Админ-панель
app.get('/admin', requireAdmin, (req, res) => {
    db.all(`SELECT id, fullName, groupName, email, rating FROM users WHERE role = 'student' ORDER BY fullName`, 
        (err, users) => {
            if (err) {
                console.error('Ошибка получения пользователей:', err);
                users = [];
            }
            res.render('admin', { users });
        });
});

// Добавление учащегося (только для админа)
app.post('/admin/add-student', requireAdmin, (req, res) => {
    const { fullName, phone, groupName, email, password } = req.body;

    // Хешируем пароль с bcrypt
    const hashedPassword = bcrypt.hashSync(password, 12);

    db.run(`INSERT INTO users (fullName, phone, groupName, email, password, role) VALUES (?, ?, ?, ?, ?, ?)`,
        [fullName, phone, groupName, email, hashedPassword, 'student'],
        function(err) {
            if (err) {
                console.error('Ошибка добавления учащегося:', err);
                return res.redirect('/admin?error=Ошибка добавления');
            }
            res.redirect('/admin?success=Учащийся добавлен');
        });
});

// Удаление пользователя (только для админа)
app.post('/admin/delete-user/:id', requireAdmin, (req, res) => {
    const userId = req.params.id;
    
    db.run(`DELETE FROM users WHERE id = ? AND role = 'student'`, [userId], function(err) {
        if (err) {
            console.error('Ошибка удаления пользователя:', err);
        }
        res.redirect('/admin');
    });
});

app.get('/auth/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/test', (req, res) => {
    res.send('✅ Сервер работает с SQLite базой данных!');
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`💾 Используется SQLite база данных`);
    console.log(`👑 Админ: admin@college.ru / admin123`);
    console.log(`👥 Студенты добавляются через админ-панель`);
});

// Закрытие базы данных при завершении
process.on('SIGINT', () => {
    db.close();
    process.exit();
});

// Страница отдельной новости
app.get('/news/:id', (req, res) => {
    const newsId = req.params.id;
    
    db.get(`SELECT n.*, u.fullName as authorName 
            FROM news n 
            JOIN users u ON n.authorId = u.id 
            WHERE n.id = ?`, [newsId], (err, news) => {
        if (err) {
            console.error('Ошибка получения новости:', err);
            return res.status(404).send('Новость не найдена');
        }
        
        if (!news) {
            return res.status(404).send('Новость не найдена');
        }

        // Получаем другие новости для боковой колонки
        db.all(`SELECT n.*, u.fullName as authorName 
                FROM news n 
                JOIN users u ON n.authorId = u.id 
                WHERE n.id != ? 
                ORDER BY n.createdAt DESC LIMIT 3`, [newsId], (err, otherNews) => {
            if (err) {
                console.error('Ошибка получения других новостей:', err);
                otherNews = [];
            }

            res.render('news-single', {
                user: req.session.user,
                news,
                otherNews
            });
        });
    });
});

// Страница всех новостей
app.get('/news', (req, res) => {
    db.all(`SELECT n.*, u.fullName as authorName 
            FROM news n 
            JOIN users u ON n.authorId = u.id 
            ORDER BY n.createdAt DESC`, (err, allNews) => {
        if (err) {
            console.error('Ошибка получения новостей:', err);
            allNews = [];
        }

        res.render('news', {
            user: req.session.user,
            news: allNews
        });
    });
});