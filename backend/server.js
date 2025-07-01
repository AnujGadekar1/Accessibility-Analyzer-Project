//backend\server.js

// 1. All requires at the very top
const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const axeCore = require('axe-core');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config(); // CRITICAL: This MUST be here, at the very top, after other requires

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key'; // Loaded from .env

// 2. Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/accessibility_analyzer_db'; // Loaded from .env

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected successfully!'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });

// 3. Mongoose Schemas and Models
// --- User Schema and Model ---
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
}, { timestamps: true });

// Pre-save hook to hash password before saving
userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

const User = mongoose.model('User', userSchema);

// --- Analysis Result Schema (Add userId field) ---
const analysisResultSchema = new mongoose.Schema({
    url: { type: String, required: true, index: true },
    timestamp: { type: Date, default: Date.now },
    score: { type: Number, required: true },
    summary: Object,
    pageInfo: Object,
    violations: Array,
    passes: Array,
    incomplete: Array,
    inapplicable: Array,
    metadata: Object,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
    timestamps: true
});

const AnalysisResult = mongoose.model('AnalysisResult', analysisResultSchema);

// 4. Middleware
app.use(cors());
app.use(express.json());

// 5. Auth Middleware
const auth = (req, res, next) => {
    const token = req.header('x-auth-token');

    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (e) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};

// 6. Helper Functions (Only once)
const isValidUrl = (string) => {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
};

const normalizeUrl = (url) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return `https://${url}`;
    }
    return url;
};

// Helper function to categorize violations
function categorizeViolation(violation) {
    const { id, tags } = violation;
    
    if (id.includes('color') || id.includes('contrast')) {
        return 'Color & Contrast';
    }
    if (id.includes('image') || id.includes('alt')) {
        return 'Images & Media';
    }
    if (id.includes('form') || id.includes('label') || id.includes('input')) {
        return 'Forms & Controls';
    }
    if (id.includes('heading') || id.includes('structure') || id.includes('landmark')) {
        return 'Structure & Navigation';
    }
    if (id.includes('keyboard') || id.includes('focus') || id.includes('tabindex')) {
        return 'Keyboard & Focus';
    }
    if (tags.includes('wcag2a') || tags.includes('wcag2aa')) {
        return 'WCAG Compliance';
    }
    
    return 'General Accessibility';
}

// Helper function to map impact to severity
function mapImpactToSeverity(impact) {
    const severityMap = {
        'critical': 'critical',
        'serious': 'high',
        'moderate': 'medium',
        'minor': 'low'
    };
    return severityMap[impact] || 'medium';
}

// Helper function to extract WCAG level
function extractWcagLevel(tags) {
    const wcagTag = tags.find(tag => tag.match(/wcag\d+[a]{1,3}/i));
    if (!wcagTag) return 'N/A';
    
    if (wcagTag.includes('wcag2a') && !wcagTag.includes('wcag2aa')) return 'A';
    if (wcagTag.includes('wcag2aa') && !wcagTag.includes('wcag2aaa')) return 'AA';
    if (wcagTag.includes('wcag2aaa')) return 'AAA';
    if (wcagTag.includes('wcag21aa')) return 'AA (2.1)';
    
    return wcagTag.toUpperCase();
}

// 7. AUTH ENDPOINTS
// Register User
app.post('/api/auth/register',
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters long'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        try {
            let user = await User.findOne({ username });
            if (user) {
                return res.status(400).json({ msg: 'User already exists' });
            }

            user = new User({ username, password });
            await user.save();

            const payload = {
                user: {
                    id: user.id
                }
            };

            jwt.sign(
                payload,
                JWT_SECRET,
                { expiresIn: '1h' },
                (err, token) => {
                    if (err) throw err;
                    res.json({ token });
                }
            );
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server Error');
        }
    }
);

// Login User
app.post('/api/auth/login',
    body('username').exists().withMessage('Username is required'),
    body('password').exists().withMessage('Password is required'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        try {
            let user = await User.findOne({ username });
            if (!user) {
                return res.status(400).json({ msg: 'Invalid Credentials' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ msg: 'Invalid Credentials' });
            }

            const payload = {
                user: {
                    id: user.id
                }
            };

            jwt.sign(
                payload,
                JWT_SECRET,
                { expiresIn: '1h' },
                (err, token) => {
                    if (err) throw err;
                    res.json({ token });
                }
            );
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server Error');
        }
    }
);

// Get Authenticated User (Private Route)
app.get('/api/auth/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 8. Main accessibility analysis endpoint (ONLY ONE!)
app.post('/api/analyze', auth, async (req, res) => {
    const { url, options = {} } = req.body;
    const userId = req.user.id;
    console.log('📥 Incoming analysis request:', url, options, 'by user:', userId);

    // Validate URL
    if (!url || !isValidUrl(normalizeUrl(url))) {
        return res.status(400).json({ error: 'Invalid or missing URL' });
    }

    let browser;
    try {
        browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(normalizeUrl(url), { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Ensure DOM is ready
        await page.waitForSelector('body', { timeout: 15000 });

        // Inject axe-core
        await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });

        // Run axe-core analysis with explicit options mapping
        const axeResults = await page.evaluate(async (axeRunOptions) => {
            // Ensure window.axe exists
            const currentAxe = typeof window.axe !== 'undefined' ? window.axe : null;
            if (!currentAxe) throw new Error('Axe-core not loaded.');

            return await currentAxe.run(document, {
                rules: axeRunOptions.rules || undefined,
                tags: axeRunOptions.tags || ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']
            });
        }, options);

        // Calculate comprehensive metrics
        const totalChecks = axeResults.violations.length + axeResults.passes.length + axeResults.incomplete.length;
        const passedChecks = axeResults.passes.length;
        const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

        // Prepare summary
        const summary = {
            totalViolations: axeResults.violations.length,
            totalPasses: axeResults.passes.length,
            totalIncomplete: axeResults.incomplete.length,
            totalInapplicable: axeResults.inapplicable.length,
            totalChecks: totalChecks,
            passedChecks: passedChecks,
            score: score
        };

        // Page info
        const pageInfo = {
            url: page.url(),
            title: await page.title()
        };

        // Enhance violations with categories, severity, and WCAG level
        const enhancedViolations = axeResults.violations.map(v => ({
            ...v,
            category: categorizeViolation(v),
            severity: mapImpactToSeverity(v.impact),
            wcagLevel: extractWcagLevel(v.tags)
        }));

        // Prepare response data (avoid shadowing 'res')
        const responseData = {
            url: page.url(),
            score,
            summary,
            pageInfo,
            violations: enhancedViolations,
            passes: axeResults.passes,
            incomplete: axeResults.incomplete,
            inapplicable: axeResults.inapplicable,
            metadata: {
                axeVersion: axeCore.version,
                analysisTime: new Date().toISOString(),
                rulesRun: totalChecks,
                options: options
            },
            userId: userId
        };

        // Save result to DB
        const analysisResult = new AnalysisResult({
            url: page.url(),
            score,
            summary,
            pageInfo,
            violations: enhancedViolations,
            passes: axeResults.passes,
            incomplete: axeResults.incomplete,
            inapplicable: axeResults.inapplicable,
            metadata: {
                axeVersion: axeCore.version,
                analysisTime: new Date().toISOString(),
                rulesRun: totalChecks,
                options: options
            },
            userId
        });
        await analysisResult.save();

        await browser.close();

        res.json(responseData);
    } catch (error) {
        if (browser) await browser.close();
        console.error('Error during analysis:', error);
        res.status(500).json({
            error: 'Failed to analyze page',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred during analysis.'
        });
    }
});

// 9. Endpoint to Fetch History from Database
app.get('/api/history', auth, async (req, res) => {
    try {
        const history = await AnalysisResult.find({ userId: req.user.id }).sort({ timestamp: -1 }).limit(50);
        res.json(history);
    } catch (error) {
        console.error('Error fetching analysis history:', error);
        res.status(500).json({
            error: 'Failed to fetch history',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while fetching history.'
        });
    }
});

// 10. Get supported rules endpoint - Corrected to use axeCore.getRules() directly
app.get('/api/rules', async (req, res) => {
    try {
        const rules = axeCore.getRules(); // Direct call - no need for Puppeteer
        res.json({
            rules: rules.map(rule => ({
                ruleId: rule.ruleId,
                description: rule.description,
                help: rule.help,
                helpUrl: rule.helpUrl,
                tags: rule.tags
            }))
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch rules',
            message: error.message
        });
    }
});

// 11. Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// 12. Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred'
    });
});

// 13. 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: 'The requested endpoint does not exist'
    });
});

// 14. Start server
app.listen(PORT, () => {
    console.log(`🚀 Accessibility Analysis Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔍 Analysis endpoint: http://localhost:${PORT}/api/analyze`);
    console.log(`📜 History endpoint: http://localhost:${PORT}/api/history (Authenticated)`);
    console.log(`🔑 Auth endpoints: /api/auth/register, /api/auth/login`);
});

// 15. Graceful shutdown (with mongoose disconnect)
process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, closing MongoDB connection and shutting down gracefully');
    await mongoose.disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, closing MongoDB connection and shutting down gracefully');
    await mongoose.disconnect();
    process.exit(0);
});