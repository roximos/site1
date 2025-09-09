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
        
        // Инициализация базы данных
        db.serialize(() => {
            // Таблица пользователей
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fullName TEXT NOT NULL,
                phone TEXT,
                groupName TEXT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'student',
                rating INTEGER DEFAULT 0,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Таблица новостей
            db.run(`CREATE TABLE IF NOT EXISTS news (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                authorId INTEGER NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (authorId) REFERENCES users (id)
            )`);

            // Таблица достижений
            db.run(`CREATE TABLE IF NOT EXISTS achievements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                studentId INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                points INTEGER DEFAULT 0,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (studentId) REFERENCES users (id)
            )`);

            // Создаем админа если его нет
            const adminPassword = bcrypt.hashSync('admin123', 12);
            db.run(`INSERT OR IGNORE INTO users (fullName, email, password, role) 
                    VALUES (?, ?, ?, ?)`,
                ['Администратор', 'admin@college.ru', adminPassword, 'admin']);

            // Удаляем тестовые новости
            db.run(`DELETE FROM news WHERE title LIKE '%Добро пожаловать%' OR title LIKE '%Система рейтинга%' OR content LIKE '%Система рейтинга%'`, 
                function(err) {
                    if (err) {
                        console.error('Ошибка удаления тестовых новостей:', err);
                    } else {
                        console.log('Удалено тестовых новостей:', this.changes);
                    }
                });

            // Создаем нормальные новости если база пустая
            db.get(`SELECT COUNT(*) as count FROM news`, (err, result) => {
                if (err) {
                    console.error('Ошибка проверки новостей:', err);
                    return;
                }
                
                if (result.count === 0) {
                    // Получаем ID админа
                    db.get(`SELECT id FROM users WHERE email = 'admin@college.ru'`, (err, admin) => {
                        if (err || !admin) return;
                        
                        const demoNews = [
                            {
                                title: 'Открытие нового компьютерного класса',
                                content: 'В колледже состоялось торжественное открытие нового компьютерного класса, оснащенного современной техникой. Студенты теперь могут заниматься на мощных компьютерах с последними версиями программного обеспечения.'
                            },
                            {
                                title: 'Олимпиада по программированию',
                                content: 'Приглашаем всех желающих принять участие в ежегодной олимпиаде по программированию. Победители получат ценные призы и возможность пройти стажировку в ведущих IT-компаниях.'
                            },
                            {
                                title: 'Новое лабораторное оборудование',
                                content: 'В колледж поступило современное оборудование для практических занятий по физике, химии и робототехнике. Это позволит студентам проводить более сложные и интересные эксперименты.'
                            }
                        ];
                        
                        demoNews.forEach((news, index) => {
                            db.run(`INSERT INTO news (title, content, authorId) VALUES (?, ?, ?)`,
                                [news.title, news.content, admin.id]);
                        });
                        
                        console.log('Добавлены демо-новости');
                    });
                }
            });
        });
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

            // Получаем последние новости (исключаем пустые)
            db.all(`SELECT n.*, u.fullName as authorName 
                   FROM news n 
                   JOIN users u ON n.authorId = u.id 
                   WHERE n.title != '' AND n.content != ''
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
    if (req.session.user) return res.redirect('/');
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

        res.redirect('/');
    });
});

// Админ-панель
app.get('/admin', requireAdmin, (req, res) => {
    // Получаем студентов
    db.all(`SELECT id, fullName, groupName, email, rating FROM users WHERE role = 'student' ORDER BY fullName`, 
        (err, users) => {
            if (err) {
                console.error('Ошибка получения пользователей:', err);
                users = [];
            }
            
            // Получаем все новости
            db.all(`SELECT n.*, u.fullName as authorName 
                    FROM news n 
                    JOIN users u ON n.authorId = u.id 
                    ORDER BY n.createdAt DESC`, 
                (err, allNews) => {
                    if (err) {
                        console.error('Ошибка получения новостей:', err);
                        allNews = [];
                    }
                    
                    res.render('admin', { 
                        users,
                        allNews,
                        error: req.query.error,
                        success: req.query.success
                    });
                });
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

// Добавление баллов студенту (только для админа)
app.post('/admin/add-points/:id', requireAdmin, (req, res) => {
    const userId = req.params.id;
    const { points } = req.body;
    
    // Проверяем, что баллы от 1 до 100
    const pointsValue = parseInt(points);
    if (isNaN(pointsValue) || pointsValue < 1 || pointsValue > 100) {
        return res.redirect('/admin?error=Неверное количество баллов (1-100)');
    }
    
    db.run(`UPDATE users SET rating = rating + ? WHERE id = ? AND role = 'student'`,
        [pointsValue, userId], function(err) {
            if (err) {
                console.error('Ошибка добавления баллов:', err);
                return res.redirect('/admin?error=Ошибка добавления баллов');
            }
            
            // Записываем достижение
            db.run(`INSERT INTO achievements (studentId, title, description, points) 
                    VALUES (?, ?, ?, ?)`,
                [userId, 'Начисление баллов', `Администратор начислил ${pointsValue} баллов`, pointsValue],
                function(err) {
                    if (err) {
                        console.error('Ошибка записи достижения:', err);
                    }
                    res.redirect('/admin?success=Баллы успешно добавлены');
                });
        });
});

// Добавление новости (только для админа)
app.get('/admin/add-news', requireAdmin, (req, res) => {
    res.render('add-news', { 
        error: req.query.error,
        success: req.query.success
    });
});

app.post('/admin/add-news', requireAdmin, upload.single('newsImage'), (req, res) => {
    const { title, content } = req.body;
    
    if (!title || !content) {
        return res.redirect('/admin/add-news?error=Заполните все поля');
    }
    
    db.run(`INSERT INTO news (title, content, authorId) VALUES (?, ?, ?)`,
        [title, content, req.session.user.id], function(err) {
            if (err) {
                console.error('Ошибка добавления новости:', err);
                return res.redirect('/admin/add-news?error=Ошибка добавления новости');
            }
            
            res.redirect('/admin/add-news?success=Новость успешно добавлена');
        });
});

// Удаление новости (только для админа)
app.post('/admin/delete-news/:id', requireAdmin, (req, res) => {
    const newsId = req.params.id;
    
    db.run(`DELETE FROM news WHERE id = ?`, [newsId], function(err) {
        if (err) {
            console.error('Ошибка удаления новости:', err);
            return res.redirect('/admin?error=Ошибка удаления новости');
        }
        res.redirect('/admin?success=Новость удалена');
    });
});

app.get('/auth/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Страница рейтинга (топ студентов)
app.get('/rating', (req, res) => {
    db.all(`SELECT id, fullName, groupName, rating FROM users WHERE role = 'student' ORDER BY rating DESC`, 
        (err, topStudents) => {
            if (err) {
                console.error('Ошибка получения студентов:', err);
                topStudents = [];
            }

            res.render('rating', {
                user: req.session.user,
                topStudents
            });
        });
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
            WHERE n.title != '' AND n.content != ''
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