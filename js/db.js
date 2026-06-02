// js/db.js - إصدار معدل لدعم الأنواع for_us / for_them
import { loadDatabase, saveDatabase } from './sqlite-storage.js';
import { showToast } from './utils.js';

let db = null;
let cache = { travelers: [], companies: [], services: [], bookings: [], vouchers: [], expenses: [] };
let cacheValid = false;

async function loadSqlJs() {
  if (!window.initSqlJs) {
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (typeof window.initSqlJs === 'function') {
          clearInterval(check);
          resolve(window.initSqlJs);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(check);
        reject(new Error('لم يتم تحميل مكتبة SQL.js بشكل صحيح'));
      }, 10000);
    });
  }
  return window.initSqlJs;
}

async function initDatabase() {
  if (db) return db;
  try {
    const initSqlJs = await loadSqlJs();
    const locateFile = (file) => `lib/${file}`;
    const SQL = await initSqlJs({ locateFile });
    const existingData = await loadDatabase();
    db = new SQL.Database(existingData);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS travelers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        passport TEXT,
        passport_expiry TEXT,
        nationality TEXT,
        address TEXT,
        balance REAL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT,
        phone TEXT,
        contact_person TEXT,
        balance REAL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT,
        price REAL,
        company_id INTEGER,
        details TEXT,
        commission_type TEXT,
        commission_value REAL
      );
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        traveler_id INTEGER,
        service_id INTEGER,
        company_id INTEGER,
        flight_number TEXT,
        airline TEXT,
        booking_date TEXT,
        travel_date TEXT,
        status TEXT,
        total_amount REAL,
        commission_amount REAL,
        notes TEXT
      );
      CREATE TABLE IF NOT EXISTS vouchers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        date TEXT,
        amount REAL,
        description TEXT,
        reference TEXT,
        traveler_id INTEGER,
        company_id INTEGER,
        booking_id INTEGER
      );
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('for_us', 'for_them')),
        date TEXT NOT NULL,
        notes TEXT,
        currency TEXT DEFAULT 'SAR'
      );
    `);
    
    // ترقية القيم القديمة incoming/outgoing إذا وجدت
    try {
      db.run("UPDATE expenses SET type = 'for_us' WHERE type = 'incoming'");
      db.run("UPDATE expenses SET type = 'for_them' WHERE type = 'outgoing'");
    } catch(e) { /* تجاهل */ }
    
    try {
      db.run("ALTER TABLE expenses ADD COLUMN currency TEXT DEFAULT 'SAR'");
    } catch(e) { /* العمود موجود بالفعل */ }
    
    await persistDatabase();
    return db;
  } catch (err) {
    throw new Error(`فشل تهيئة قاعدة البيانات: ${err.message}`);
  }
}

async function persistDatabase() {
  if (!db) return;
  const data = db.export();
  await saveDatabase(data);
}

async function exec(sql, params = []) {
  const database = await initDatabase();
  const stmt = database.prepare(sql);
  let result;
  try {
    result = stmt.run(params);
    if (/^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(sql)) {
      await persistDatabase();
      invalidateCache();
    }
    return result;
  } finally {
    stmt.free();
  }
}

async function query(sql, params = []) {
  const database = await initDatabase();
  const stmt = database.prepare(sql);
  const rows = [];
  try {
    stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject());
  } finally {
    stmt.free();
  }
  return rows;
}

export async function refreshCaches() {
  await initDatabase();
  const [travelers, companies, services, bookings, vouchers, expenses] = await Promise.all([
    query('SELECT * FROM travelers'),
    query('SELECT * FROM companies'),
    query('SELECT * FROM services'),
    query('SELECT * FROM bookings ORDER BY id DESC'),
    query('SELECT * FROM vouchers'),
    query('SELECT * FROM expenses ORDER BY id DESC')
  ]);
  cache = { travelers, companies, services, bookings, vouchers, expenses };
  cache.bookings = cache.bookings.map(b => {
    const paid = cache.vouchers
      .filter(v => v.type === 'receipt' && v.booking_id == b.id)
      .reduce((sum, v) => sum + v.amount, 0);
    const balance = (b.total_amount || 0) - paid;
    return {
      ...b,
      traveler: cache.travelers.find(t => t.id == b.traveler_id),
      service: cache.services.find(s => s.id == b.service_id),
      company: cache.companies.find(c => c.id == b.company_id),
      paid,
      balance
    };
  });
  cacheValid = true;
}

export function getCache() {
  if (!cacheValid) refreshCaches();
  return cache;
}
export function invalidateCache() { cacheValid = false; }

function calculateCommission(service, totalAmount) {
  if (!service.commission_value) return 0;
  if (service.commission_type === 'percent') return totalAmount * service.commission_value / 100;
  return service.commission_value;
}

// ========== Travelers ==========
export async function addTraveler(data) {
  if (!data.name) throw new Error('اسم المسافر مطلوب');
  const result = await exec(
    'INSERT INTO travelers (name, phone, email, passport, passport_expiry, nationality, address, balance) VALUES (?,?,?,?,?,?,?,0)',
    [data.name, data.phone || null, data.email || null, data.passport || null, data.passport_expiry || null, data.nationality || null, data.address || null]
  );
  await refreshCaches();
  return { id: result.lastInsertRowid, ...data };
}

export async function updateTraveler(data) {
  if (!data.id) throw new Error('معرف المسافر مطلوب');
  await exec(
    'UPDATE travelers SET name=?, phone=?, email=?, passport=?, passport_expiry=?, nationality=?, address=? WHERE id=?',
    [data.name, data.phone, data.email, data.passport, data.passport_expiry, data.nationality, data.address, data.id]
  );
  await refreshCaches();
  return data;
}

export async function deleteTraveler(id) {
  const used = await query('SELECT COUNT(*) as count FROM bookings WHERE traveler_id = ?', [id]);
  if (used[0].count > 0) throw new Error('لا يمكن حذف المسافر لارتباطه بحجوزات');
  await exec('DELETE FROM travelers WHERE id = ?', [id]);
  await refreshCaches();
  return { success: true };
}

// ========== Companies ==========
export async function addCompany(data) {
  if (!data.name) throw new Error('اسم الشركة مطلوب');
  const result = await exec(
    'INSERT INTO companies (name, type, phone, contact_person, balance) VALUES (?,?,?,?,0)',
    [data.name, data.type || 'airline', data.phone || null, data.contact_person || null]
  );
  await refreshCaches();
  return { id: result.lastInsertRowid, ...data };
}

export async function updateCompany(data) {
  if (!data.id) throw new Error('معرف الشركة مطلوب');
  await exec(
    'UPDATE companies SET name=?, type=?, phone=?, contact_person=? WHERE id=?',
    [data.name, data.type, data.phone, data.contact_person, data.id]
  );
  await refreshCaches();
  return data;
}

export async function deleteCompany(id) {
  const usedServices = await query('SELECT COUNT(*) as count FROM services WHERE company_id = ?', [id]);
  const usedBookings = await query('SELECT COUNT(*) as count FROM bookings WHERE company_id = ?', [id]);
  if (usedServices[0].count > 0 || usedBookings[0].count > 0) throw new Error('لا يمكن حذف الشركة لارتباطها بخدمات أو حجوزات');
  await exec('DELETE FROM companies WHERE id = ?', [id]);
  await refreshCaches();
  return { success: true };
}

// ========== Services ==========
export async function addService(data) {
  if (!data.name) throw new Error('اسم الخدمة مطلوب');
  const companyId = data.company_id ? parseInt(data.company_id) : null;
  const result = await exec(
    'INSERT INTO services (name, type, price, company_id, details, commission_type, commission_value) VALUES (?,?,?,?,?,?,?)',
    [data.name, data.type || 'ticket', data.price || 0, companyId,
     data.details || null, data.commission_type || 'percent', data.commission_value || 0]
  );
  await refreshCaches();
  return { id: result.lastInsertRowid, ...data };
}

export async function updateService(data) {
  if (!data.id) throw new Error('معرف الخدمة مطلوب');
  const companyId = data.company_id ? parseInt(data.company_id) : null;
  await exec(
    'UPDATE services SET name=?, type=?, price=?, company_id=?, details=?, commission_type=?, commission_value=? WHERE id=?',
    [data.name, data.type, data.price, companyId,
     data.details, data.commission_type, data.commission_value, data.id]
  );
  await refreshCaches();
  return data;
}

export async function deleteService(id) {
  const used = await query('SELECT COUNT(*) as count FROM bookings WHERE service_id = ?', [id]);
  if (used[0].count > 0) throw new Error('لا يمكن حذف الخدمة لارتباطها بحجوزات');
  await exec('DELETE FROM services WHERE id = ?', [id]);
  await refreshCaches();
  return { success: true };
}

async function getCompanyName(companyId) {
  const rows = await query('SELECT name FROM companies WHERE id = ?', [companyId]);
  return rows[0] ? rows[0].name : null;
}

// ========== Bookings ==========
export async function addBooking(data) {
  const { traveler_id, service_id, total_amount, paid_amount, booking_date, ...rest } = data;
  const traveler = (await query('SELECT * FROM travelers WHERE id = ?', [traveler_id]))[0];
  if (!traveler) throw new Error('المسافر غير موجود');
  const service = (await query('SELECT * FROM services WHERE id = ?', [service_id]))[0];
  if (!service) throw new Error('الخدمة غير موجودة');
  if (!service.company_id) throw new Error('⚠️ الخدمة غير مرتبطة بشركة');
  const commission = calculateCommission(service, total_amount) || 0;
  const company_id = parseInt(service.company_id);
  const airlineAmount = total_amount - commission;
  const usedDate = booking_date || new Date().toISOString().slice(0,10);
  const airlineName = rest.airline || (await getCompanyName(company_id)) || null;
  await exec(
    `INSERT INTO bookings (traveler_id, service_id, company_id, flight_number, airline, booking_date, travel_date, status, total_amount, commission_amount, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [traveler_id, service_id, company_id,
     rest.flight_number || null, airlineName,
     usedDate, rest.travel_date || null,
     rest.status || 'pending', total_amount, commission, rest.notes || null]
  );
  let bookingId = null;
  const lastIdRows = await query('SELECT last_insert_rowid() as id');
  if (lastIdRows && lastIdRows[0] && lastIdRows[0].id) bookingId = lastIdRows[0].id;
  if (!bookingId) {
    const maxIdRows = await query('SELECT MAX(id) as id FROM bookings');
    if (maxIdRows && maxIdRows[0] && maxIdRows[0].id) bookingId = maxIdRows[0].id;
  }
  if (!bookingId) throw new Error('فشل الحصول على معرف الحجز');
  if (paid_amount && paid_amount > 0) {
    const paidVal = parseFloat(paid_amount);
    if (isNaN(paidVal)) throw new Error('المبلغ المدفوع غير صالح');
    await exec(
      'INSERT INTO vouchers (type, amount, date, description, traveler_id, booking_id) VALUES (?,?,?,?,?,?)',
      ['receipt', paidVal, usedDate, 'دفعة أولى', traveler_id, bookingId]
    );
  }
  const travelerDelta = total_amount - (paid_amount || 0);
  await exec('UPDATE travelers SET balance = balance + ? WHERE id = ?', [travelerDelta, traveler_id]);
  await exec('UPDATE companies SET balance = balance + ? WHERE id = ?', [airlineAmount, company_id]);
  await refreshCaches();
  return { id: bookingId };
}

export async function updateBooking(data) {
  if (!data.id) throw new Error('معرف الحجز مطلوب');
  const id = data.id;
  const old = (await query('SELECT * FROM bookings WHERE id = ?', [id]))[0];
  if (!old) throw new Error('الحجز غير موجود');
  const newTravelerId = data.traveler_id || old.traveler_id;
  let newServiceId = data.service_id || old.service_id;
  let newTotalAmount = data.total_amount !== undefined ? parseFloat(data.total_amount) : (old.total_amount || 0);
  const newStatus = data.status || old.status;
  const service = (await query('SELECT * FROM services WHERE id = ?', [newServiceId]))[0];
  if (!service) throw new Error('الخدمة غير موجودة');
  if (!service.company_id && newStatus !== 'cancelled') throw new Error('⚠️ الخدمة غير مرتبطة بشركة');
  const newCommission = calculateCommission(service, newTotalAmount) || 0;
  const newCompanyId = service.company_id ? parseInt(service.company_id) : null;
  const newAirlineAmount = newTotalAmount - newCommission;
  const oldTotalAmount = old.total_amount || 0;
  const oldCommission = old.commission_amount || 0;
  const oldAirlineAmount = oldTotalAmount - oldCommission;
  const oldTravelerId = old.traveler_id;
  const oldCompanyId = old.company_id;
  await exec(
    `UPDATE bookings SET traveler_id=?, service_id=?, company_id=?, flight_number=?, airline=?, booking_date=?, travel_date=?, status=?, total_amount=?, commission_amount=?, notes=?
     WHERE id=?`,
    [newTravelerId, newServiceId, newCompanyId,
     data.flight_number ?? old.flight_number, data.airline ?? old.airline,
     data.booking_date ?? old.booking_date, data.travel_date ?? old.travel_date,
     newStatus, newTotalAmount, newCommission, data.notes ?? old.notes, id]
  );
  if (newStatus === 'cancelled' && old.status !== 'cancelled') {
    const paidVouchers = await query('SELECT * FROM vouchers WHERE booking_id = ? AND type = ?', [id, 'receipt']);
    const totalPaid = paidVouchers.reduce((s, v) => s + (v.amount || 0), 0);
    const oldTravelerDelta = oldTotalAmount - totalPaid;
    await exec('UPDATE travelers SET balance = balance - ? WHERE id = ?', [oldTravelerDelta, oldTravelerId]);
    for (const v of paidVouchers) await exec('UPDATE travelers SET balance = balance + ? WHERE id = ?', [v.amount, v.traveler_id]);
    if (oldCompanyId) await exec('UPDATE companies SET balance = balance - ? WHERE id = ?', [oldAirlineAmount, oldCompanyId]);
    const paymentVouchers = await query('SELECT * FROM vouchers WHERE booking_id = ? AND type = ?', [id, 'payment']);
    for (const v of paymentVouchers) await exec('UPDATE companies SET balance = balance + ? WHERE id = ?', [v.amount, v.company_id]);
  } else {
    const oldPaidVouchers = await query('SELECT * FROM vouchers WHERE booking_id = ? AND type = ?', [id, 'receipt']);
    const oldTotalPaid = oldPaidVouchers.reduce((s, v) => s + (v.amount || 0), 0);
    const oldTravelerDelta = oldTotalAmount - oldTotalPaid;
    if (oldTravelerId) await exec('UPDATE travelers SET balance = balance - ? WHERE id = ?', [oldTravelerDelta, oldTravelerId]);
    const newPaidVouchers = await query('SELECT * FROM vouchers WHERE booking_id = ? AND type = ?', [id, 'receipt']);
    const newTotalPaid = newPaidVouchers.reduce((s, v) => s + (v.amount || 0), 0);
    const newTravelerDelta = newTotalAmount - newTotalPaid;
    if (newTravelerId) await exec('UPDATE travelers SET balance = balance + ? WHERE id = ?', [newTravelerDelta, newTravelerId]);
    if (oldCompanyId) await exec('UPDATE companies SET balance = balance - ? WHERE id = ?', [oldAirlineAmount, oldCompanyId]);
    if (newCompanyId) await exec('UPDATE companies SET balance = balance + ? WHERE id = ?', [newAirlineAmount, newCompanyId]);
  }
  await refreshCaches();
  return { id };
}

export async function deleteBooking(id) {
  const booking = (await query('SELECT * FROM bookings WHERE id = ?', [id]))[0];
  if (!booking) throw new Error('الحجز غير موجود');
  const vouchers = await query('SELECT * FROM vouchers WHERE booking_id = ?', [id]);
  for (const v of vouchers) {
    if (v.type === 'receipt') await exec('UPDATE travelers SET balance = balance + ? WHERE id = ?', [v.amount, v.traveler_id]);
    else if (v.type === 'payment') await exec('UPDATE companies SET balance = balance + ? WHERE id = ?', [v.amount, v.company_id]);
  }
  await exec('DELETE FROM vouchers WHERE booking_id = ?', [id]);
  const totalAmount = Number(booking.total_amount) || 0;
  await exec('UPDATE travelers SET balance = balance - ? WHERE id = ?', [totalAmount, booking.traveler_id]);
  const commissionAmount = Number(booking.commission_amount) || 0;
  const airlineAmount = totalAmount - commissionAmount;
  if (booking.company_id && airlineAmount !== 0) await exec('UPDATE companies SET balance = balance - ? WHERE id = ?', [airlineAmount, booking.company_id]);
  await exec('DELETE FROM bookings WHERE id = ?', [id]);
  await refreshCaches();
  return { success: true };
}

// ========== Vouchers ==========
export async function addVoucher(data, allowNegative = false) {
  const { type, amount, date, description, reference, traveler_id, company_id, booking_id } = data;
  if (amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
  if (type === 'receipt' && !traveler_id) throw new Error('المسافر مطلوب لسند القبض');
  if (type === 'payment' && !company_id) throw new Error('الشركة مطلوبة لسند الدفع');
  if (type === 'receipt') {
    const traveler = (await query('SELECT balance FROM travelers WHERE id = ?', [traveler_id]))[0];
    if (traveler && !allowNegative && traveler.balance - amount < 0) throw new Error(`لا يمكن إتمام العملية: سيصبح رصيد المسافر سالباً (${traveler.balance - amount})`);
  } else if (type === 'payment') {
    const company = (await query('SELECT balance FROM companies WHERE id = ?', [company_id]))[0];
    if (company && !allowNegative && company.balance - amount < 0) throw new Error(`لا يمكن إتمام العملية: سيصبح رصيد الشركة سالباً (${company.balance - amount})`);
  }
  const result = await exec(
    `INSERT INTO vouchers (type, amount, date, description, reference, traveler_id, company_id, booking_id)
     VALUES (?,?,?,?,?,?,?,?)`,
    [type, amount, date || new Date().toISOString().slice(0,10),
     description || null, reference || null,
     traveler_id || null, company_id || null, booking_id || null]
  );
  if (type === 'receipt') await exec('UPDATE travelers SET balance = balance - ? WHERE id = ?', [amount, traveler_id]);
  else if (type === 'payment') await exec('UPDATE companies SET balance = balance - ? WHERE id = ?', [amount, company_id]);
  await refreshCaches();
  return { id: result.lastInsertRowid };
}

export async function deleteVoucher(id, allowNegative = false) {
  const voucher = (await query('SELECT * FROM vouchers WHERE id = ?', [id]))[0];
  if (!voucher) throw new Error('السند غير موجود');
  if (voucher.type === 'receipt') {
    const traveler = (await query('SELECT balance FROM travelers WHERE id = ?', [voucher.traveler_id]))[0];
    if (traveler && !allowNegative && traveler.balance + voucher.amount < 0) throw new Error('سيصبح رصيد المسافر سالباً بعد حذف السند');
    await exec('UPDATE travelers SET balance = balance + ? WHERE id = ?', [voucher.amount, voucher.traveler_id]);
  } else if (voucher.type === 'payment') {
    const company = (await query('SELECT balance FROM companies WHERE id = ?', [voucher.company_id]))[0];
    if (company && !allowNegative && company.balance + voucher.amount < 0) throw new Error('سيصبح رصيد الشركة سالباً بعد حذف السند');
    await exec('UPDATE companies SET balance = balance + ? WHERE id = ?', [voucher.amount, voucher.company_id]);
  }
  await exec('DELETE FROM vouchers WHERE id = ?', [id]);
  await refreshCaches();
  return { success: true };
}

// ========== Expenses (حسابات هوى الشام) مع العملة وأنواع for_us / for_them ==========
export async function addExpense(data) {
  if (!data.company_name) throw new Error('اسم الشركة مطلوب');
  if (!data.amount || data.amount <= 0) throw new Error('المبلغ مطلوب وأكبر من صفر');
  if (!data.type || !['for_us', 'for_them'].includes(data.type)) throw new Error('نوع القيد غير صحيح (لنا / له)');
  const date = data.date || new Date().toISOString().slice(0,10);
  const currency = data.currency || 'SAR';
  const result = await exec(
    'INSERT INTO expenses (company_name, amount, type, date, notes, currency) VALUES (?,?,?,?,?,?)',
    [data.company_name, data.amount, data.type, date, data.notes || null, currency]
  );
  await refreshCaches();
  return { id: result.lastInsertRowid, ...data };
}

export async function updateExpense(data) {
  if (!data.id) throw new Error('معرف القيد مطلوب');
  if (!data.company_name) throw new Error('اسم الشركة مطلوب');
  if (!data.amount || data.amount <= 0) throw new Error('المبلغ مطلوب وأكبر من صفر');
  if (!data.type || !['for_us', 'for_them'].includes(data.type)) throw new Error('نوع القيد غير صحيح (لنا / له)');
  await exec(
    'UPDATE expenses SET company_name=?, amount=?, type=?, date=?, notes=?, currency=? WHERE id=?',
    [data.company_name, data.amount, data.type, data.date, data.notes || null, data.currency || 'SAR', data.id]
  );
  await refreshCaches();
  return data;
}

export async function deleteExpense(id) {
  await exec('DELETE FROM expenses WHERE id = ?', [id]);
  await refreshCaches();
  return { success: true };
}

// ========== Summary ==========
async function getSummary() {
  await refreshCaches();
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0,10);
  const bookingsThisMonth = cache.bookings.filter(b => b.booking_date >= firstDay && b.booking_date <= lastDay);
  const totalRevenue = bookingsThisMonth.reduce((s, b) => s + b.total_amount, 0);
  const totalPaid = cache.vouchers.filter(v => v.type === 'receipt' && v.date >= firstDay && v.date <= lastDay).reduce((s, v) => s + v.amount, 0);
  const pendingBalance = cache.bookings.reduce((s, b) => s + (b.total_amount - (b.paid || 0)), 0);
  const commissionsEarned = bookingsThisMonth.reduce((s, b) => s + b.commission_amount, 0);
  const expensesThisMonth = cache.vouchers.filter(v => v.type === 'expense' && v.date >= firstDay && v.date <= lastDay).reduce((s, v) => s + v.amount, 0);
  const netProfit = commissionsEarned - expensesThisMonth;
  const totalCompanyBalance = cache.companies.reduce((sum, c) => sum + (c.balance || 0), 0);
  return { totalBookings: cache.bookings.length, totalRevenue, totalPaid, pendingBalance, netProfit, totalCompanyBalance };
}

// ========== API Router ==========
export async function apiCall(endpoint, method = 'GET', body = {}, options = { allowNegative: false }) {
  await initDatabase();
  if (!cacheValid) await refreshCaches();
  const [path, qs] = endpoint.split('?');
  const params = new URLSearchParams(qs || '');
  const id = params.get('id');
  switch (path) {
    case '/summary': return getSummary();
    case '/travelers':
      if (method === 'GET') return cache.travelers;
      if (method === 'POST') return addTraveler(body);
      if (method === 'PUT') return updateTraveler(body);
      if (method === 'DELETE') return deleteTraveler(id);
      break;
    case '/companies':
      if (method === 'GET') return cache.companies;
      if (method === 'POST') return addCompany(body);
      if (method === 'PUT') return updateCompany(body);
      if (method === 'DELETE') return deleteCompany(id);
      break;
    case '/services':
      if (method === 'GET') return cache.services;
      if (method === 'POST') return addService(body);
      if (method === 'PUT') return updateService(body);
      if (method === 'DELETE') return deleteService(id);
      break;
    case '/bookings':
      if (method === 'GET') return cache.bookings;
      if (method === 'POST') return addBooking(body);
      if (method === 'PUT') return updateBooking(body);
      if (method === 'DELETE') return deleteBooking(id);
      break;
    case '/vouchers':
      if (method === 'GET') return cache.vouchers;
      if (method === 'POST') return addVoucher(body, options.allowNegative);
      if (method === 'DELETE') return deleteVoucher(id, options.allowNegative);
      break;
    case '/expenses':
      if (method === 'GET') return cache.expenses;
      if (method === 'POST') return addExpense(body);
      if (method === 'PUT') return updateExpense(body);
      if (method === 'DELETE') return deleteExpense(id);
      break;
    default: return [];
  }
}

export async function recalcAllBalances() {
  await initDatabase();
  await refreshCaches();
  for (const t of cache.travelers) {
    const totalBookings = cache.bookings.filter(b => b.traveler_id === t.id).reduce((s, b) => s + b.total_amount, 0);
    const paid = cache.vouchers.filter(v => v.type === 'receipt' && v.traveler_id === t.id).reduce((s, v) => s + v.amount, 0);
    await exec('UPDATE travelers SET balance = ? WHERE id = ?', [totalBookings - paid, t.id]);
  }
  for (const c of cache.companies) {
    const airlineDue = cache.bookings.filter(b => b.company_id === c.id).reduce((s, b) => s + (b.total_amount - b.commission_amount), 0);
    const paid = cache.vouchers.filter(v => v.type === 'payment' && v.company_id === c.id).reduce((s, v) => s + v.amount, 0);
    await exec('UPDATE companies SET balance = ? WHERE id = ?', [airlineDue - paid, c.id]);
  }
  await refreshCaches();
  showToast('تم إعادة حساب جميع الأرصدة', 'success');
}

export async function ensureDatabase() {
  await initDatabase();
}

export async function exportFullDatabase() {
  await refreshCaches();
  const data = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    travelers: cache.travelers,
    companies: cache.companies,
    services: cache.services,
    bookings: cache.bookings,
    vouchers: cache.vouchers,
    expenses: cache.expenses
  };
  return JSON.stringify(data, null, 2);
}

export async function importFullDatabase(jsonData) {
  const data = JSON.parse(jsonData);
  if (!data.travelers || !data.companies || !data.services || !data.bookings || !data.vouchers || !data.expenses) {
    throw new Error('ملف النسخة الاحتياطية غير صالح: يفتقد لأحد الجداول الأساسية');
  }
  await initDatabase();
  await exec('DELETE FROM travelers');
  await exec('DELETE FROM companies');
  await exec('DELETE FROM services');
  await exec('DELETE FROM bookings');
  await exec('DELETE FROM vouchers');
  await exec('DELETE FROM expenses');
  
  for (const t of data.travelers) {
    await exec(`INSERT INTO travelers (id, name, phone, email, passport, passport_expiry, nationality, address, balance) VALUES (?,?,?,?,?,?,?,?,?)`,
      [t.id, t.name, t.phone || null, t.email || null, t.passport || null, t.passport_expiry || null, t.nationality || null, t.address || null, t.balance || 0]);
  }
  for (const c of data.companies) {
    await exec(`INSERT INTO companies (id, name, type, phone, contact_person, balance) VALUES (?,?,?,?,?,?)`,
      [c.id, c.name, c.type || null, c.phone || null, c.contact_person || null, c.balance || 0]);
  }
  for (const s of data.services) {
    await exec(`INSERT INTO services (id, name, type, price, company_id, details, commission_type, commission_value) VALUES (?,?,?,?,?,?,?,?)`,
      [s.id, s.name, s.type || null, s.price || 0, s.company_id || null, s.details || null, s.commission_type || 'percent', s.commission_value || 0]);
  }
  for (const b of data.bookings) {
    await exec(`INSERT INTO bookings (id, traveler_id, service_id, company_id, flight_number, airline, booking_date, travel_date, status, total_amount, commission_amount, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [b.id, b.traveler_id, b.service_id, b.company_id || null, b.flight_number || null, b.airline || null, b.booking_date, b.travel_date || null, b.status || 'pending', b.total_amount || 0, b.commission_amount || 0, b.notes || null]);
  }
  for (const v of data.vouchers) {
    await exec(`INSERT INTO vouchers (id, type, date, amount, description, reference, traveler_id, company_id, booking_id) VALUES (?,?,?,?,?,?,?,?,?)`,
      [v.id, v.type, v.date, v.amount, v.description || null, v.reference || null, v.traveler_id || null, v.company_id || null, v.booking_id || null]);
  }
  for (const e of data.expenses) {
    await exec(`INSERT INTO expenses (id, company_name, amount, type, date, notes, currency) VALUES (?,?,?,?,?,?,?)`,
      [e.id, e.company_name, e.amount, e.type, e.date, e.notes || null, e.currency || 'SAR']);
  }
  await refreshCaches();
}

export async function resetDatabase() {
  await initDatabase();
  db.run("DROP TABLE IF EXISTS travelers");
  db.run("DROP TABLE IF EXISTS companies");
  db.run("DROP TABLE IF EXISTS services");
  db.run("DROP TABLE IF EXISTS bookings");
  db.run("DROP TABLE IF EXISTS vouchers");
  db.run("DROP TABLE IF EXISTS expenses");
  await initDatabase();
  await refreshCaches();
  showToast('✅ تم مسح قاعدة البيانات وإعادة تهيئتها بنجاح', 'success');
}

export const addTravelerDirect = addTraveler;
export const updateTravelerDirect = updateTraveler;
export const deleteTravelerDirect = deleteTraveler;
export const addCompanyDirect = addCompany;
export const updateCompanyDirect = updateCompany;
export const deleteCompanyDirect = deleteCompany;
export const addServiceDirect = addService;
export const updateServiceDirect = updateService;
export const deleteServiceDirect = deleteService;
export const addBookingDirect = addBooking;
export const updateBookingDirect = updateBooking;
export const deleteBookingDirect = deleteBooking;
export const addVoucherDirect = addVoucher;
export const deleteVoucherDirect = deleteVoucher;
export const addExpenseDirect = addExpense;
export const updateExpenseDirect = updateExpense;
export const deleteExpenseDirect = deleteExpense;
