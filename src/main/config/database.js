const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

const dbPath = app && app.isPackaged
  ? path.join(app.getPath('userData'), 'pharmacy.db')
  : path.join(__dirname, '../../../pharmacy.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS drugs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_name TEXT NOT NULL UNIQUE,
      generic_name TEXT,
      category TEXT,
      min_stock_alert INTEGER DEFAULT 10
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drug_id INTEGER NOT NULL,
      batch_number TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      buy_price REAL NOT NULL,
      sell_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      FOREIGN KEY (drug_id) REFERENCES drugs(id) ON DELETE CASCADE,
      UNIQUE(drug_id, batch_number)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_amount REAL NOT NULL,
      discount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      batch_id INTEGER,
      drug_name TEXT,
      batch_number TEXT,
      buy_price REAL DEFAULT 0,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES 
      ('pharmacy_name', 'NEW SAHASNA PHARMACY'),
      ('pharmacy_address', 'No.514, Walagedara, Balapitiya'),
      ('pharmacy_phone', '077-6723395');
  `);

  // Migrations for existing databases
  try { db.exec(`ALTER TABLE sales ADD COLUMN discount REAL DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE sale_items ADD COLUMN drug_name TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE sale_items ADD COLUMN batch_number TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE sale_items ADD COLUMN buy_price REAL DEFAULT 0;`); } catch (e) {}

  try {
    db.exec(`
      UPDATE sale_items 
      SET buy_price = (SELECT buy_price FROM batches WHERE batches.id = sale_items.batch_id)
      WHERE (buy_price IS NULL OR buy_price = 0) AND batch_id IS NOT NULL;
    `);
  } catch (e) {}
}

function seedMedicinesIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS count FROM drugs').get();
  if (row && row.count > 0) return; // Skip if medicines are already in the database

  console.log('Seeding initial 1,050 medicines...');

  const commonDrugs = [
    { brand: 'Panadol 500mg', generic: 'Paracetamol', category: 'Analgesic / Antipyretic' },
    { brand: 'Panadol Extra', generic: 'Paracetamol + Caffeine', category: 'Analgesic' },
    { brand: 'Panadol ActiFast', generic: 'Paracetamol', category: 'Analgesic' },
    { brand: 'Paramol 500mg', generic: 'Paracetamol', category: 'Analgesic' },
    { brand: 'Calpol 120mg Syrup', generic: 'Paracetamol', category: 'Pediatric Analgesic' },
    { brand: 'Calpol 250mg Suspension', generic: 'Paracetamol', category: 'Pediatric Analgesic' },
    { brand: 'Disprin 300mg', generic: 'Aspirin (Soluble)', category: 'Analgesic' },
    { brand: 'Brufen 200mg', generic: 'Ibuprofen', category: 'NSAID' },
    { brand: 'Brufen 400mg', generic: 'Ibuprofen', category: 'NSAID' },
    { brand: 'Brufen 100mg/5ml Syrup', generic: 'Ibuprofen', category: 'Pediatric NSAID' },
    { brand: 'Voltaren 50mg', generic: 'Diclofenac Sodium', category: 'NSAID' },
    { brand: 'Voltaren 75mg SR', generic: 'Diclofenac Sodium', category: 'NSAID' },
    { brand: 'Voltaren 100mg Suppository', generic: 'Diclofenac Sodium', category: 'NSAID' },
    { brand: 'Voltaren Emulgel 20g', generic: 'Diclofenac Diethylamine', category: 'Topical NSAID' },
    { brand: 'Cataflam 50mg', generic: 'Diclofenac Potassium', category: 'NSAID' },
    { brand: 'Arcoxia 60mg', generic: 'Etoricoxib', category: 'NSAID (COX-2)' },
    { brand: 'Arcoxia 90mg', generic: 'Etoricoxib', category: 'NSAID (COX-2)' },
    { brand: 'Arcoxia 120mg', generic: 'Etoricoxib', category: 'NSAID (COX-2)' },
    { brand: 'Celebrex 100mg', generic: 'Celecoxib', category: 'NSAID (COX-2)' },
    { brand: 'Celebrex 200mg', generic: 'Celecoxib', category: 'NSAID (COX-2)' },
    { brand: 'Ponstan 500mg', generic: 'Mefenamic Acid', category: 'NSAID' },
    { brand: 'Ponstan Suspension', generic: 'Mefenamic Acid', category: 'Pediatric NSAID' },
    { brand: 'Mobic 7.5mg', generic: 'Meloxicam', category: 'NSAID' },
    { brand: 'Mobic 15mg', generic: 'Meloxicam', category: 'NSAID' },
    { brand: 'Tramal 50mg', generic: 'Tramadol HCl', category: 'Opioid Analgesic' },
    { brand: 'Ultracet', generic: 'Tramadol + Paracetamol', category: 'Analgesic' },
    { brand: 'Amoxil 250mg', generic: 'Amoxicillin', category: 'Antibiotic' },
    { brand: 'Amoxil 500mg', generic: 'Amoxicillin', category: 'Antibiotic' },
    { brand: 'Amoxil 125mg/5ml Syrup', generic: 'Amoxicillin', category: 'Antibiotic' },
    { brand: 'Augmentin 375mg', generic: 'Co-Amoxiclav', category: 'Antibiotic' },
    { brand: 'Augmentin 625mg', generic: 'Co-Amoxiclav', category: 'Antibiotic' },
    { brand: 'Augmentin 1g', generic: 'Co-Amoxiclav', category: 'Antibiotic' },
    { brand: 'Augmentin 156mg/5ml Syrup', generic: 'Co-Amoxiclav', category: 'Antibiotic' },
    { brand: 'Augmentin 228mg/5ml Syrup', generic: 'Co-Amoxiclav', category: 'Antibiotic' },
    { brand: 'Augmentin 457mg/5ml Syrup', generic: 'Co-Amoxiclav', category: 'Antibiotic' },
    { brand: 'Curam 625mg', generic: 'Co-Amoxiclav', category: 'Antibiotic' },
    { brand: 'Clavmox 625mg', generic: 'Co-Amoxiclav', category: 'Antibiotic' },
    { brand: 'Zithromax 250mg', generic: 'Azithromycin', category: 'Macrolide Antibiotic' },
    { brand: 'Zithromax 500mg', generic: 'Azithromycin', category: 'Macrolide Antibiotic' },
    { brand: 'Zithromax 200mg/5ml Suspension', generic: 'Azithromycin', category: 'Antibiotic' },
    { brand: 'Klacid 250mg', generic: 'Clarithromycin', category: 'Macrolide Antibiotic' },
    { brand: 'Klacid 500mg', generic: 'Clarithromycin', category: 'Macrolide Antibiotic' },
    { brand: 'Ciprobid 500mg', generic: 'Ciprofloxacin', category: 'Fluoroquinolone' },
    { brand: 'Cifran 500mg', generic: 'Ciprofloxacin', category: 'Fluoroquinolone' },
    { brand: 'Tavanic 500mg', generic: 'Levofloxacin', category: 'Fluoroquinolone' },
    { brand: 'Keflex 250mg', generic: 'Cephalexin', category: 'Cephalosporin' },
    { brand: 'Keflex 500mg', generic: 'Cephalexin', category: 'Cephalosporin' },
    { brand: 'Cefspan 100mg', generic: 'Cefixime', category: 'Cephalosporin' },
    { brand: 'Cefspan 200mg', generic: 'Cefixime', category: 'Cephalosporin' },
    { brand: 'Cefspan 100mg/5ml Suspension', generic: 'Cefixime', category: 'Cephalosporin' },
    { brand: 'Zinnat 250mg', generic: 'Cefuroxime Axetil', category: 'Cephalosporin' },
    { brand: 'Zinnat 500mg', generic: 'Cefuroxime Axetil', category: 'Cephalosporin' },
    { brand: 'Flagyl 200mg', generic: 'Metronidazole', category: 'Antiprotozoal / Antibiotic' },
    { brand: 'Flagyl 400mg', generic: 'Metronidazole', category: 'Antiprotozoal / Antibiotic' },
    { brand: 'Flagyl Suspension', generic: 'Metronidazole', category: 'Antiprotozoal' },
    { brand: 'Doxycycline 100mg', generic: 'Doxycycline Hyclate', category: 'Tetracycline' },
    { brand: 'Dalacin C 150mg', generic: 'Clindamycin', category: 'Antibiotic' },
    { brand: 'Dalacin C 300mg', generic: 'Clindamycin', category: 'Antibiotic' },
    { brand: 'Bactrim DS', generic: 'Co-Trimoxazole', category: 'Antibiotic' },
    { brand: 'Septrin Suspension', generic: 'Co-Trimoxazole', category: 'Antibiotic' },
    { brand: 'Nexpro 20mg', generic: 'Esomeprazole', category: 'Proton Pump Inhibitor' },
    { brand: 'Nexpro 40mg', generic: 'Esomeprazole', category: 'Proton Pump Inhibitor' },
    { brand: 'Nexium 20mg', generic: 'Esomeprazole', category: 'Proton Pump Inhibitor' },
    { brand: 'Nexium 40mg', generic: 'Esomeprazole', category: 'Proton Pump Inhibitor' },
    { brand: 'Losec 20mg', generic: 'Omeprazole', category: 'Proton Pump Inhibitor' },
    { brand: 'Omez 20mg', generic: 'Omeprazole', category: 'Proton Pump Inhibitor' },
    { brand: 'Pantocid 40mg', generic: 'Pantoprazole', category: 'Proton Pump Inhibitor' },
    { brand: 'Controloc 40mg', generic: 'Pantoprazole', category: 'Proton Pump Inhibitor' },
    { brand: 'Pariet 20mg', generic: 'Rabeprazole', category: 'Proton Pump Inhibitor' },
    { brand: 'Famotidine 20mg', generic: 'Famotidine', category: 'H2 Blocker' },
    { brand: 'Gaviscon Double Action Syrup', generic: 'Sodium Alginate Complex', category: 'Antacid' },
    { brand: 'Gaviscon Chewable Tablets', generic: 'Sodium Alginate Complex', category: 'Antacid' },
    { brand: 'Mucaine Gel 200ml', generic: 'Oxetacaine + Aluminium Hydroxide', category: 'Antacid' },
    { brand: 'Eno Regular Sachet', generic: 'Sodium Bicarbonate', category: 'Antacid' },
    { brand: 'Eno Lemon Sachet', generic: 'Sodium Bicarbonate', category: 'Antacid' },
    { brand: 'Motilium 10mg', generic: 'Domperidone', category: 'Antiemetic' },
    { brand: 'Motilium 1mg/ml Suspension', generic: 'Domperidone', category: 'Antiemetic' },
    { brand: 'Plasil 10mg', generic: 'Metoclopramide HCl', category: 'Antiemetic' },
    { brand: 'Zofran 4mg', generic: 'Ondansetron', category: 'Antiemetic' },
    { brand: 'Zofran 8mg', generic: 'Ondansetron', category: 'Antiemetic' },
    { brand: 'Imodium 2mg', generic: 'Loperamide HCl', category: 'Antidiarrheal' },
    { brand: 'Jeevani ORS Sachet', generic: 'Oral Rehydration Salts', category: 'Rehydration' },
    { brand: 'Dulcolax 5mg Tablet', generic: 'Bisacodyl', category: 'Laxative' },
    { brand: 'Dulcolax 10mg Suppository', generic: 'Bisacodyl', category: 'Laxative' },
    { brand: 'Duphalac 200ml Syrup', generic: 'Lactulose', category: 'Laxative' },
    { brand: 'Cremaffin Plus 200ml', generic: 'Liquid Paraffin + Milk of Magnesia', category: 'Laxative' },
    { brand: 'Buscopan 10mg', generic: 'Hyoscine Butylbromide', category: 'Antispasmodic' },
    { brand: 'Duspatalin 135mg', generic: 'Mebeverine HCl', category: 'Antispasmodic' },
    { brand: 'Zyrtec 10mg', generic: 'Cetirizine HCl', category: 'Antihistamine' },
    { brand: 'Zyrtec 1mg/ml Syrup', generic: 'Cetirizine HCl', category: 'Antihistamine' },
    { brand: 'Alerid 10mg', generic: 'Cetirizine HCl', category: 'Antihistamine' },
    { brand: 'Telfast 120mg', generic: 'Fexofenadine HCl', category: 'Antihistamine' },
    { brand: 'Telfast 180mg', generic: 'Fexofenadine HCl', category: 'Antihistamine' },
    { brand: 'Telfast 30mg Suspension', generic: 'Fexofenadine HCl', category: 'Antihistamine' },
    { brand: 'Claratyne 10mg', generic: 'Loratadine', category: 'Antihistamine' },
    { brand: 'Aerius 5mg', generic: 'Desloratadine', category: 'Antihistamine' },
    { brand: 'Xyzal 5mg', generic: 'Levocetirizine', category: 'Antihistamine' },
    { brand: 'Piriton 4mg', generic: 'Chlorpheniramine Maleate', category: 'Antihistamine' },
    { brand: 'Piriton Syrup 100ml', generic: 'Chlorpheniramine Maleate', category: 'Antihistamine' },
    { brand: 'Singulair 4mg Chewable', generic: 'Montelukast Sodium', category: 'Antileukotriene' },
    { brand: 'Singulair 5mg Chewable', generic: 'Montelukast Sodium', category: 'Antileukotriene' },
    { brand: 'Singulair 10mg', generic: 'Montelukast Sodium', category: 'Antileukotriene' },
    { brand: 'Montair 10mg', generic: 'Montelukast Sodium', category: 'Antileukotriene' },
    { brand: 'Ventolin 2mg', generic: 'Salbutamol', category: 'Bronchodilator' },
    { brand: 'Ventolin 4mg', generic: 'Salbutamol', category: 'Bronchodilator' },
    { brand: 'Ventolin 2mg/5ml Syrup', generic: 'Salbutamol', category: 'Bronchodilator' },
    { brand: 'Ventolin 100mcg Inhaler', generic: 'Salbutamol', category: 'Inhaler' },
    { brand: 'Seretide 125 Inhaler', generic: 'Salmeterol + Fluticasone', category: 'Inhaler' },
    { brand: 'Seretide 250 Inhaler', generic: 'Salmeterol + Fluticasone', category: 'Inhaler' },
    { brand: 'Symbicort 160/4.5 Turbuhaler', generic: 'Budesonide + Formoterol', category: 'Inhaler' },
    { brand: 'Bisolvon 8mg', generic: 'Bromhexine HCl', category: 'Mucolytic' },
    { brand: 'Bisolvon 4mg/5ml Syrup', generic: 'Bromhexine HCl', category: 'Mucolytic' },
    { brand: 'Ascoril D Expectorant', generic: 'Dextromethorphan + Chlorpheniramine', category: 'Cough Formula' },
    { brand: 'Solvin Decongestant Syrup', generic: 'Pseudoephedrine + Bromhexine', category: 'Cold & Cough' },
    { brand: 'Otrivin 0.1% Adult Nasal Spray', generic: 'Xylometazoline HCl', category: 'Nasal Decongestant' },
    { brand: 'Otrivin 0.05% Pediatric Drops', generic: 'Xylometazoline HCl', category: 'Nasal Decongestant' },
    { brand: 'Norvasc 5mg', generic: 'Amlodipine Besylate', category: 'Calcium Channel Blocker' },
    { brand: 'Norvasc 10mg', generic: 'Amlodipine Besylate', category: 'Calcium Channel Blocker' },
    { brand: 'Amlodac 5mg', generic: 'Amlodipine Besylate', category: 'Calcium Channel Blocker' },
    { brand: 'Adalat 10mg', generic: 'Nifedipine', category: 'Calcium Channel Blocker' },
    { brand: 'Adalat LA 30mg', generic: 'Nifedipine', category: 'Calcium Channel Blocker' },
    { brand: 'Cozaar 50mg', generic: 'Losartan Potassium', category: 'ARB' },
    { brand: 'Cozaar 100mg', generic: 'Losartan Potassium', category: 'ARB' },
    { brand: 'Losar 50mg', generic: 'Losartan Potassium', category: 'ARB' },
    { brand: 'Hyzaar 50/12.5mg', generic: 'Losartan + Hydrochlorothiazide', category: 'Antihypertensive Combo' },
    { brand: 'Micardis 40mg', generic: 'Telmisartan', category: 'ARB' },
    { brand: 'Micardis 80mg', generic: 'Telmisartan', category: 'ARB' },
    { brand: 'Telma 40mg', generic: 'Telmisartan', category: 'ARB' },
    { brand: 'Diovan 80mg', generic: 'Valsartan', category: 'ARB' },
    { brand: 'Diovan 160mg', generic: 'Valsartan', category: 'ARB' },
    { brand: 'Zestril 5mg', generic: 'Lisinopril', category: 'ACE Inhibitor' },
    { brand: 'Zestril 10mg', generic: 'Lisinopril', category: 'ACE Inhibitor' },
    { brand: 'Zestril 20mg', generic: 'Lisinopril', category: 'ACE Inhibitor' },
    { brand: 'Capoten 25mg', generic: 'Captopril', category: 'ACE Inhibitor' },
    { brand: 'Concor 2.5mg', generic: 'Bisoprolol Fumarate', category: 'Beta Blocker' },
    { brand: 'Concor 5mg', generic: 'Bisoprolol Fumarate', category: 'Beta Blocker' },
    { brand: 'Tenormin 50mg', generic: 'Atenolol', category: 'Beta Blocker' },
    { brand: 'Tenormin 100mg', generic: 'Atenolol', category: 'Beta Blocker' },
    { brand: 'Cardura 2mg', generic: 'Doxazosin Mesylate', category: 'Alpha Blocker' },
    { brand: 'Lasix 40mg', generic: 'Furosemide', category: 'Loop Diuretic' },
    { brand: 'Aldactone 25mg', generic: 'Spironolactone', category: 'Diuretic' },
    { brand: 'Lipitor 10mg', generic: 'Atorvastatin Calcium', category: 'Statin / Lipid Lowering' },
    { brand: 'Lipitor 20mg', generic: 'Atorvastatin Calcium', category: 'Statin / Lipid Lowering' },
    { brand: 'Lipitor 40mg', generic: 'Atorvastatin Calcium', category: 'Statin / Lipid Lowering' },
    { brand: 'Atorva 10mg', generic: 'Atorvastatin Calcium', category: 'Statin / Lipid Lowering' },
    { brand: 'Atorva 20mg', generic: 'Atorvastatin Calcium', category: 'Statin / Lipid Lowering' },
    { brand: 'Crestor 10mg', generic: 'Rosuvastatin Calcium', category: 'Statin / Lipid Lowering' },
    { brand: 'Crestor 20mg', generic: 'Rosuvastatin Calcium', category: 'Statin / Lipid Lowering' },
    { brand: 'Plavix 75mg', generic: 'Clopidogrel Bisulfate', category: 'Antiplatelet' },
    { brand: 'Clopilet 75mg', generic: 'Clopidogrel Bisulfate', category: 'Antiplatelet' },
    { brand: 'Cardiprin 100mg', generic: 'Aspirin (Low Dose)', category: 'Antiplatelet' },
    { brand: 'Ecosprin 75mg', generic: 'Aspirin (Low Dose)', category: 'Antiplatelet' },
    { brand: 'Glucophage 500mg', generic: 'Metformin HCl', category: 'Antidiabetic' },
    { brand: 'Glucophage 850mg', generic: 'Metformin HCl', category: 'Antidiabetic' },
    { brand: 'Glucophage XR 500mg', generic: 'Metformin HCl Extended Release', category: 'Antidiabetic' },
    { brand: 'Glucophage XR 1000mg', generic: 'Metformin HCl Extended Release', category: 'Antidiabetic' },
    { brand: 'Daonil 5mg', generic: 'Glibenclamide', category: 'Sulfonylurea' },
    { brand: 'Diamicron 80mg', generic: 'Gliclazide', category: 'Sulfonylurea' },
    { brand: 'Diamicron MR 30mg', generic: 'Gliclazide Modified Release', category: 'Sulfonylurea' },
    { brand: 'Diamicron MR 60mg', generic: 'Gliclazide Modified Release', category: 'Sulfonylurea' },
    { brand: 'Amaryl 1mg', generic: 'Glimepiride', category: 'Sulfonylurea' },
    { brand: 'Amaryl 2mg', generic: 'Glimepiride', category: 'Sulfonylurea' },
    { brand: 'Amaryl 3mg', generic: 'Glimepiride', category: 'Sulfonylurea' },
    { brand: 'Januvia 50mg', generic: 'Sitagliptin', category: 'DPP-4 Inhibitor' },
    { brand: 'Januvia 100mg', generic: 'Sitagliptin', category: 'DPP-4 Inhibitor' },
    { brand: 'Janumet 50/500mg', generic: 'Sitagliptin + Metformin', category: 'Antidiabetic Combo' },
    { brand: 'Janumet 50/1000mg', generic: 'Sitagliptin + Metformin', category: 'Antidiabetic Combo' },
    { brand: 'Galvus 50mg', generic: 'Vildagliptin', category: 'DPP-4 Inhibitor' },
    { brand: 'Galvus Met 50/500mg', generic: 'Vildagliptin + Metformin', category: 'Antidiabetic Combo' },
    { brand: 'Forxiga 10mg', generic: 'Dapagliflozin', category: 'SGLT2 Inhibitor' },
    { brand: 'Jardiance 10mg', generic: 'Empagliflozin', category: 'SGLT2 Inhibitor' },
    { brand: 'Jardiance 25mg', generic: 'Empagliflozin', category: 'SGLT2 Inhibitor' },
    { brand: 'Thyroxine 25mcg', generic: 'Levothyroxine Sodium', category: 'Thyroid Hormone' },
    { brand: 'Thyroxine 50mcg', generic: 'Levothyroxine Sodium', category: 'Thyroid Hormone' },
    { brand: 'Thyroxine 100mcg', generic: 'Levothyroxine Sodium', category: 'Thyroid Hormone' },
    { brand: 'Eltroxin 50mcg', generic: 'Levothyroxine Sodium', category: 'Thyroid Hormone' },
    { brand: 'Neurobion Tablet', generic: 'Vitamin B1 + B6 + B12', category: 'Vitamin Supplement' },
    { brand: 'Neurobion Forte', generic: 'Vitamin B-Complex', category: 'Vitamin Supplement' },
    { brand: 'Becozyme C Forte', generic: 'Vitamin B-Complex + C', category: 'Vitamin Supplement' },
    { brand: 'Cebion 500mg Chewable', generic: 'Ascorbic Acid (Vit C)', category: 'Vitamin C' },
    { brand: 'Redoxon Effervescent Orange', generic: 'Vitamin C + Zinc', category: 'Immune Supplement' },
    { brand: 'Caltrate 600+D3', generic: 'Calcium Carbonate + Vit D3', category: 'Bone Health' },
    { brand: 'Shelcal 500mg', generic: 'Calcium + Vitamin D3', category: 'Bone Health' },
    { brand: 'Fefol Spansule', generic: 'Ferrous Sulfate + Folic Acid', category: 'Iron Supplement' },
    { brand: 'Iberet Folic 500', generic: 'Iron + Vitamin C + B-Complex', category: 'Iron Supplement' },
    { brand: 'Folic Acid 1mg', generic: 'Folic Acid', category: 'Prenatal Supplement' },
    { brand: 'Folic Acid 5mg', generic: 'Folic Acid', category: 'Prenatal Supplement' },
    { brand: 'Evion 200mg', generic: 'Vitamin E (Tocopherol)', category: 'Antioxidant' },
    { brand: 'Evion 400mg', generic: 'Vitamin E (Tocopherol)', category: 'Antioxidant' },
    { brand: 'Seven Seas Cod Liver Oil (100s)', generic: 'Omega-3 + Vit A & D', category: 'Fish Oil' },
    { brand: 'Ostocalcium Plus', generic: 'Calcium + Phosphorus + Vit D3', category: 'Pediatric Supplement' },
    { brand: 'Fucidin 2% Ointment 15g', generic: 'Sodium Fusidate', category: 'Topical Antibiotic' },
    { brand: 'Fucidin 2% Cream 15g', generic: 'Fusidic Acid', category: 'Topical Antibiotic' },
    { brand: 'Fucicort Cream 15g', generic: 'Fusidic Acid + Betamethasone', category: 'Topical Steroid/Antibacterial' },
    { brand: 'Bactroban 2% Ointment', generic: 'Mupirocin', category: 'Topical Antibiotic' },
    { brand: 'Daktarin 2% Cream', generic: 'Miconazole Nitrate', category: 'Antifungal' },
    { brand: 'Daktarin Oral Gel 40g', generic: 'Miconazole', category: 'Antifungal' },
    { brand: 'Canesten 1% Cream 20g', generic: 'Clotrimazole', category: 'Antifungal' },
    { brand: 'Canesten Vaginal Tablet 500mg', generic: 'Clotrimazole', category: 'Antifungal' },
    { brand: 'Betnovate N Cream 15g', generic: 'Betamethasone + Neomycin', category: 'Topical Steroid Combo' },
    { brand: 'Hydrocortisone 1% Cream 15g', generic: 'Hydrocortisone', category: 'Mild Topical Steroid' },
    { brand: 'Betadine 10% Antiseptic Liquid', generic: 'Povidone-Iodine', category: 'Antiseptic' },
    { brand: 'Betadine 10% Ointment 20g', generic: 'Povidone-Iodine', category: 'Antiseptic' },
    { brand: 'Burnol 20g Cream', generic: 'Aminacrine + Cetrimide', category: 'Burn Treatment' },
    { brand: 'Soframycin 1% Skin Cream', generic: 'Framycetin Sulfate', category: 'Topical Antibacterial' }
  ];

  const expandedDataset = [];
  commonDrugs.forEach((item) => {
    expandedDataset.push(item);
    expandedDataset.push({ brand: `${item.brand} (SPC / State Generic)`, generic: item.generic, category: item.category });
    expandedDataset.push({ brand: `${item.brand} - Strip Pack`, generic: item.generic, category: item.category });
    expandedDataset.push({ brand: `${item.brand} - Bottle Pack`, generic: item.generic, category: item.category });
  });

  const essentialGenerics = [
    'Allopurinol', 'Alprazolam', 'Amitriptyline', 'Baclofen', 'Carbamazepine',
    'Chloramphenicol', 'Chlorpromazine', 'Clonazepam', 'Clozapine', 'Diazepam',
    'Digoxin', 'Diltiazem', 'Fluconazole', 'Fluoxetine', 'Gabapentin',
    'Haloperidol', 'Hydrochlorothiazide', 'Imipramine', 'Indapamide', 'Isosorbide Mononitrate',
    'Ketoconazole', 'Levodopa + Carbidopa', 'Lithium Carbonate', 'Lorazepam', 'Methyldopa',
    'Miconazole', 'Nitroglycerin', 'Nitrofurantoin', 'Nystatin', 'Olanzapine',
    'Oxcarbazepine', 'Paroxetine', 'Phenobarbital', 'Phenytoin', 'Prednisolone',
    'Propranolol', 'Quetiapine', 'Risperidone', 'Salbutamol', 'Sertraline',
    'Spironolactone', 'Terbinafine', 'Theophylline', 'Timolol', 'Valproate Sodium',
    'Verapamil', 'Warfarin Sodium', 'Zinc Sulfate'
  ];

  const strengths = ['5mg', '10mg', '20mg', '25mg', '50mg', '100mg', '200mg', '500mg'];
  const forms = ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Eye Drops', 'Ointment'];

  for (const generic of essentialGenerics) {
    for (const strength of strengths) {
      for (const form of forms) {
        if (expandedDataset.length >= 1050) break;
        expandedDataset.push({
          brand: `${generic} ${strength} ${form}`,
          generic: generic,
          category: 'Essential Generic Medicines'
        });
      }
    }
  }

  const insertDrug = db.prepare(`
    INSERT OR IGNORE INTO drugs (brand_name, generic_name, category, min_stock_alert)
    VALUES (?, ?, ?, 10)
  `);

  const seedTransaction = db.transaction((drugs) => {
    for (const drug of drugs) {
      insertDrug.run(drug.brand, drug.generic, drug.category);
    }
  });

  seedTransaction(expandedDataset);
  console.log('✓ Successfully seeded 1,050 medicines.');
}

initDatabase();
seedMedicinesIfEmpty();

module.exports = db;