const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// Создаем/подключаем базу данных
const db = new sqlite3.Database('./database/student_rating.db', (err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err);
    } else {
        console.log('Подключение к SQLite базе данных установлено');
    }
});

// Создаем таблицы
db.serialize(() => {
    // Таблица пользователей
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT NOT NULL,
        phone TEXT NOT NULL,
        groupName TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        rating INTEGER DEFAULT 0,
        role TEXT DEFAULT 'student',
        avatar TEXT DEFAULT '',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица достижений
    db.run(`CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        studentId INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        points INTEGER NOT NULL,
        evidence TEXT DEFAULT '',
        approved BOOLEAN DEFAULT FALSE,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (studentId) REFERENCES users (id)
    )`);

    // Таблица новостей
    db.run(`CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        authorId INTEGER NOT NULL,
        image TEXT DEFAULT '',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (authorId) REFERENCES users (id)
    )`);

    // Добавляем тестового администратора
    const hashedPassword = bcrypt.hashSync('admin123', 12);
    db.run(`INSERT OR IGNORE INTO users (fullName, phone, groupName, email, password, role, rating) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['Администратор', '+79990000000', 'АДМИН', 'admin@college.ru', hashedPassword, 'admin', 100]);

    // Добавляем тестовых студентов
    const studentPassword = bcrypt.hashSync('student123', 12);
    db.run(`INSERT OR IGNORE INTO users (fullName, phone, groupName, email, password, rating) 
            VALUES (?, ?, ?, ?, ?, ?)`,
        ['Савенкова Алина', '+79991111111', 'ИСИП-20', 'alina@college.ru', studentPassword, 99]);

    db.run(`INSERT OR IGNORE INTO users (fullName, phone, groupName, email, password, rating) 
            VALUES (?, ?, ?, ?, ?, ?)`,
        ['Лазарев Алексей', '+79992222222', 'ИСИП-20', 'alexey@college.ru', studentPassword, 76]);

    // Добавляем тестовые новости
    db.run(`INSERT OR IGNORE INTO news (title, content, authorId) 
            VALUES (?, ?, ?)`,
        ['Добро пожаловать!', 'Система рейтинга учащихся запущена!', 1]);

    console.log('База данных инициализирована');
});

db.close();