const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors'); // นำเข้า cors
const path = require('path');
const app = express();
const port = 5000; // พอร์ตสำหรับ Backend

// ใช้ CORS middleware
app.use(cors());
// ใช้ express.json() เพื่อให้ Express สามารถอ่าน JSON จาก request body ได้
app.use(express.json());
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

// เชื่อมต่อฐานข้อมูล SQLite
// ตรวจสอบให้แน่ใจว่า database.db อยู่ในโฟลเดอร์เดียวกันกับ server.js
const db = new sqlite3.Database('./POS.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

//--------------------------------------- Route สำหรับการเข้าสู่ระบบผู้ใช้ -------------------------------------------
app.post('/api/userslogin', async (req, res) => {
    try {
        const { username, password } = await req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        return await db.get("SELECT user_name,user_password FROM Users WHERE user_name = ? AND user_password = ?", [username, password], (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!row) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }
            // หากพบผู้ใช้ที่ตรงกัน ให้ส่งข้อมูลผู้ใช้กลับไป
            db.get("SELECT * FROM Users WHERE user_name = ?", [username], (err, resultuser) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                return res.json({
                    message: 'Login successful',
                    user: row.user_name,
                    resultuser
                });
            });
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//-----------------------------------------------------------------------------------------------------

// -----------------------------------Route สำหรับการเพิ่มข้อมูลสินค้า และ อัพไฟล์รูป -----------------------------------
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // โฟลเดอร์ที่จะเก็บไฟล์
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });
// บันทึกข้อมูลสินค้า
app.post('/api/products', upload.single('image'), (req, res) => {
    const { name, price, cost, detail, date, unitID, categoryID, userID, quantity } = req.body;
    const image = req.file ? req.file.filename : null;

    if (!name || !price || !cost || !detail || !date || !unitID || !categoryID || !userID || !quantity) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const sql = `INSERT INTO Products (product_name, product_price, product_cost, image, product_detail, datetime_create, unit_id, category_id, user_id, product_quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [name, price, cost, image, detail, date, unitID, categoryID, userID, quantity];

    db.run(sql, params, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({
            message: 'Product added successfully',
            productId: this.lastID,
            image: image
        });
    });
});
//-----------------------------------------------------------------------------------------------------

//----------------------------------- เรียกใช้รูปภาพ ---------------------------------------------------
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
//-----------------------------------------------------------------------------------------------------

// -----------------------------------Route สำหรับการดึงข้อมูลสินค้า-----------------------------------
app.get('/api/showproducts', (req, res) => {
    const sql = "SELECT *, Category.category_name, Unit.unit_name FROM Products INNER JOIN Category ON Products.category_id = Category.category_id INNER JOIN Unit ON Products.unit_id = Unit.unit_id ORDER BY Products.product_id DESC";
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({
            message: "success",
            data: rows
        });
    });
});
//-----------------------------------------------------------------------------------------------------

//----------------------------------- Route สำหรับดึงข้อมูลประเภทสินค้า -----------------------------------
app.get('/api/category', (req, res) => {
    const sql = "SELECT * FROM Category";
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({
            message: "success",
            data: rows
        });
    });
});
//----------------------------------------------------------------------------------------------------

//---------------------------------- Route สำหรับดึงข้อมูลหน่วยสินค้า -----------------------------------
app.get('/api/unit', (req, res) => {
    const sql = "SELECT * FROM Unit";
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({
            message: "success",
            data: rows
        });
    });
});
//----------------------------------------------------------------------------------------------------

//------------------------------------ ลบข้อมูลสินค้า -----------------------------------
app.delete('/api/deleteproduct_product/:id', (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM Products WHERE product_id = ?";
    db.run(sql, [id], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ message: 'Product deleted successfully' });
    });
});
//-----------------------------------------------------------------------------------------------------

//----------------------------------- เพิ่มรายชื่อผู้ใช้งาน -----------------------------------------
app.post('/api/addusers', (req, res) => {
    const { firstname, lastname, username, password, address, email, phone, status } = req.body;
    if (!firstname || !lastname || !username || !password || !email) {
        return res.status(400).json({ error: 'First name, last name, username, password and email are required' });
    }
    const sql = "INSERT INTO Users (user_firstname, user_lastname, user_name, user_password, user_address, user_email, user_tel, user_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    const params = [firstname, lastname, username, password, address, email, phone, status];
    db.run(sql, params, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: 'User added successfully', userId: this.lastID });
    });
});
//---------------------------------------------------------------------------------------

//----------------------------------- แสดงรายชื่อผู้ใช้งาน --------------------------------------
app.get('/api/showusers', (req, res) => {
    const sql = "SELECT user_id, user_firstname, user_lastname, user_name, user_tel, user_address, user_email, user_status FROM Users";
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({
            message: "success",
            data: rows
        });
    });
});
//--------------------------------------------------------------------------------------

//---------------------------------- ลบข้อมูลผู้ใช้ -----------------------------------
app.delete('/api/deleteuser/:id', (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM Users WHERE user_id = ?";
    db.run(sql, [id], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'User deleted successfully' });
    });
});
//-----------------------------------------------------------------------------------------------------

//---------------------------------- แก้ไขข้อมูลผู้ใช้งาน -----------------------------------------------
app.put('/api/updateuser/:id', (req, res) => {
    const { id } = req.params;
    const { firstname, username, password, address, email, phone, status } = req.body;

    if (!firstname || !username || !password || !email) {
        return res.status(400).json({ error: 'First name, username, password and email are required' });
    }

    const sql = "UPDATE Users SET user_firstname = ?, user_name = ?, user_password = ?, user_address = ?, user_email = ?, user_tel = ?, user_status = ? WHERE user_id = ?";
    const params = [firstname, username, password, address, email, phone, status, id];

    db.run(sql, params, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'User updated successfully' });
    });
});
//-----------------------------------------------------------------------------------------------

//---------------------------------- เพิ่มสินค้าลงใน Bill_item -----------------------------------------------
app.post('/api/addbillitem', (req, res) => {
    // console.log("👉 รับ req.body:", req.body); // เช็คก่อนเลย

    const { billNo, products, user_id } = req.body;
    // console.log("👉 billNo:", billNo);
    // console.log("👉 products:", products);
    // console.log("👉 user_id:", user_id);
    if (!billNo || !products || !Array.isArray(products) || products.length === 0 || !user_id ) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const sql = "INSERT INTO Bill_item (bill_no, product_id, quantity, user_id) VALUES (?, ?, ?, ?)";

    const inserts = products.map(item => {
        return new Promise((resolve, reject) => {
            const params = [billNo, item.product_id, item.quantity, user_id];
            // console.log("👉 กำลัง insert:", params); // log ที่จะ insert
            db.run(sql, params, function (err) {
                if (err) {
                    console.error("❌ SQL Error:", err.message);
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    });

    Promise.all(inserts)
        .then(ids => {
            res.json({ message: 'Bill items added successfully', billNo, insertedIds: ids });
        })
        .catch(err => {
            console.error("❌ Promise Error:", err.message);
            res.status(500).json({ error: err.message });
        });
});
//-----------------------------------------------------------------------------------------------------

//---------------------------------- เพิ่มข้อมูลบิลลงใน Report_bill -----------------------------------------------
app.post('/api/reportbill', (req, res) => {
    console.log("👉 รับ req.body:", req.body);

    const { billNo, paymentStatus, paymentMethod, paidDate, paidTime, total, cash } = req.body;

    if ([billNo, paymentStatus, paymentMethod, paidDate, paidTime, total, cash].some(v => v === undefined || v === null)) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const sql = "INSERT INTO Report_bill (bill_no, payment_status, payment_method, date, time, total, cash) VALUES (?, ?, ?, ?, ?, ?, ?)";
    const params = [billNo, paymentStatus, paymentMethod, paidDate, paidTime, total, cash];

    console.log("Params for SQL:", params);

    db.run(sql, params, function (err) {
        if (err) {
            console.log("SQL Error:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Report bill added successfully', billNo });
    });
});
//-------------------------------------------------------------------------------------------------------------

//---------------------------------- ดึงข้อมูลราคาขายทั้งหมด -----------------------------------------------
app.get('/api/totalsales', (req, res) => {
    const sql = "SELECT SUM(total) as totalsales FROM Report_bill";
    db.get(sql, [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: row || { totalsales: 0 } });
    // console.log("👉 totalsales:", row);
});

});
//-------------------------------------------------------------------------------------------------------------

//---------------------------------- ดึงข้อมูลบิลทั้งหมด -----------------------------------------------
app.get('/api/report', (req, res) => {
    const sql = "SELECT * FROM Report_bill";
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ data: rows });
    });
});
//-------------------------------------------------------------------------------------------------------------

//---------------------------------- ดึงข้อมูลร้านค้า -----------------------------------------------
app.get('/api/shop_address', (req, res) => {
    const sql = "SELECT * FROM Shop";
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ data: rows });
    });
});
//-------------------------------------------------------------------------------------------------------------

// เริ่มต้น Server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);

});
//         }
//         console.log('Close the database connection.');
//         process.exit(0);
//     });
// });