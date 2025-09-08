const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: [true, 'ФИО обязательно'],
        trim: true
    },
    phone: {
        type: String,
        required: [true, 'Номер телефона обязателен'],
        match: [/^\+?[1-9]\d{1,14}$/, 'Неверный формат телефона']
    },
    group: {
        type: String,
        required: [true, 'Группа обязательна'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email обязателен'],
        unique: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Неверный формат email']
    },
    password: {
        type: String,
        required: [true, 'Пароль обязателен'],
        minlength: 6,
        select: false
    },
    rating: {
        type: Number,
        default: 0
    },
    role: {
        type: String,
        enum: ['student', 'admin'],
        default: 'student'
    },
    avatar: {
        type: String,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Шифрование пароля с bcrypt
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Метод для проверки пароля
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

module.exports = mongoose.model('User', userSchema);