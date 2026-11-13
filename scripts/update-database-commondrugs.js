const fs = require('fs');
const path = require('path');

// Helper to generate checksum digit for valid EAN-13 barcodes
function generateEan13(index) {
  const prefix = '479'; // GS1 Sri Lanka prefix
  const serial = String(index).padStart(9, '0');
  const code12 = prefix + serial;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code12[i], 10);
    sum += (i % 2 === 0) ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return code12 + checkDigit;
}

// Templates covering Sri Lankan pharmacy market
const drugTemplates = [
  // --- ANALGESICS & NSAIDS ---
  {
    category: 'Analgesics & Antipyretics',
    generic: 'Paracetamol',
    brands: ['Panadol', 'Calpol', 'Para', 'Fevadol', 'Dolo', 'Pacimol', 'Crocin', 'Paramol', 'PCM (SPMC)', 'Tylenol', 'Panamed', 'Pyrigesic'],
    strengths: ['120mg/5ml Syrup 60ml', '120mg/5ml Syrup 100ml', '250mg/5ml Suspension 60ml', '500mg Tablet', '650mg Tablet', '100mg/ml Infant Drops 15ml', '125mg Suppository', '250mg Suppository', '1g IV Infusion 100ml', 'Actifast 500mg Tablet', 'Extra 500/65mg Tablet', 'Soluble 500mg Effervescent']
  },
  {
    category: 'Analgesics & Antipyretics',
    generic: 'Ibuprofen',
    brands: ['Brufen', 'Ibugesic', 'Profen', 'Ibugard', 'Ibuprofen (SPMC)', 'Advil', 'Nurofen', 'Ibuflam', 'Dolofen'],
    strengths: ['100mg/5ml Suspension 60ml', '100mg/5ml Suspension 100ml', '200mg Tablet', '400mg Tablet', '600mg Tablet', '800mg SR Tablet', '5% Gel 30g', '5% Gel 50g', 'Plus (Ibuprofen 400mg + Paracetamol 325mg)']
  },
  {
    category: 'Analgesics & Antipyretics',
    generic: 'Diclofenac Sodium',
    brands: ['Voltaren', 'Dicloran', 'Voveran', 'Cataflam', 'Diclofenac (SPMC)', 'Dynapar', 'Diclogesic', 'Jonac', 'Diclowin'],
    strengths: ['25mg Enteric Coated Tablet', '50mg Enteric Coated Tablet', '75mg/3ml Injection', '100mg Retard Capsule', '100mg SR Tablet', '1% Emulgel 20g', '1% Emulgel 50g', '1% Emulgel 100g', '12.5mg Suppository', '25mg Suppository', '50mg Suppository', '75mg SR Tablet']
  },
  {
    category: 'Analgesics & Antipyretics',
    generic: 'Mefenamic Acid',
    brands: ['Ponstan', 'Mefacid', 'Meftal', 'Mefenamic (SPMC)', 'Ponstel', 'Mefast', 'Dolfenal', 'Dysmen'],
    strengths: ['50mg/5ml Suspension 60ml', '250mg Capsule', '500mg Tablet', 'Forte 500mg Tablet', 'Spas (Mefenamic 250mg + Dicyclomine 10mg)']
  },
  {
    category: 'Analgesics & Antipyretics',
    generic: 'Tramadol Hydrochloride',
    brands: ['Tramal', 'Tradol', 'Tramazac', 'Ultram', 'Tramcontin', 'Dolotram', 'Supridol'],
    strengths: ['50mg Capsule', '100mg SR Tablet', '50mg/ml Injection 2ml', '100mg/2ml Injection', 'Plus (Tramadol 37.5mg + Paracetamol 325mg Tablet)']
  },
  {
    category: 'Analgesics & Antipyretics',
    generic: 'Aceclofenac',
    brands: ['Zerodol', 'Hifenac', 'Aceclo', 'Dolokind', 'Movace', 'Acemiz', 'Altrocin'],
    strengths: ['100mg Tablet', '200mg SR Tablet', 'P (Aceclofenac 100mg + Paracetamol 325mg)', 'SP (Aceclofenac + Paracetamol + Serratiopeptidase)', 'MR (Aceclofenac + Paracetamol + Chlorzoxazone)', 'Gel 30g']
  },
  {
    category: 'Analgesics & Antipyretics',
    generic: 'Meloxicam',
    brands: ['Mobic', 'Melox', 'Mel-OD', 'M-Cam', 'Loxicam', 'Muvera'],
    strengths: ['7.5mg Tablet', '15mg Tablet', '15mg/1.5ml Injection', 'OD 7.5mg Dispersible Tablet', 'OD 15mg Dispersible Tablet']
  },
  {
    category: 'Analgesics & Antipyretics',
    generic: 'Celecoxib',
    brands: ['Celebrex', 'Cobix', 'Celcox', 'Zycel', 'Celib', 'Revicox'],
    strengths: ['100mg Capsule', '200mg Capsule', '400mg Capsule']
  },
  {
    category: 'Analgesics & Antipyretics',
    generic: 'Etoricoxib',
    brands: ['Arcoxia', 'Torcoxia', 'Etoshine', 'Etorvel', 'Nucoxia', 'Retoz', 'Ezact'],
    strengths: ['60mg Tablet', '90mg Tablet', '120mg Tablet', 'MR (Etoricoxib 60mg + Thiocolchicoside 4mg)']
  },
  {
    category: 'Analgesics & Antipyretics',
    generic: 'Naproxen',
    brands: ['Naprosyn', 'Xenobid', 'Naxdom', 'Naprogesic', 'Aleve'],
    strengths: ['250mg Tablet', '500mg Tablet', '500mg SR Tablet', 'D 250 (Naproxen 250mg + Domperidone 10mg)', 'D 500 (Naproxen 500mg + Domperidone 10mg)']
  },

  // --- ANTIBIOTICS & ANTIMICROBIALS ---
  {
    category: 'Antibiotics & Anti-infectives',
    generic: 'Amoxicillin',
    brands: ['Amoxil', 'Mox', 'Novamox', 'Amoxicap', 'Amoxicillin (SPMC)', 'Wymox', 'Trimox', 'Ospamox'],
    strengths: ['125mg/5ml Dry Syrup 60ml', '125mg/5ml Dry Syrup 100ml', '250mg/5ml Dry Syrup 60ml', '250mg/5ml Dry Syrup 100ml', '250mg Capsule', '500mg Capsule', '125mg Dispersible Tablet', '250mg Dispersible Tablet', '500mg Dispersible Tablet', '875mg Tablet', '1g Tablet']
  },
  {
    category: 'Antibiotics & Anti-infectives',
    generic: 'Amoxicillin + Clavulanic Acid',
    brands: ['Augmentin', 'Curam', 'Clavmox', 'Moxclav', 'Klavox', 'Enhancin', 'Amiclav', 'Augpen', 'Cavumox'],
    strengths: ['156.25mg/5ml Suspension 60ml', '156.25mg/5ml Suspension 100ml', '228.5mg/5ml Suspension 70ml', '312.5mg/5ml Suspension 60ml', '312.5mg/5ml Suspension 100ml', '457mg/5ml Suspension 70ml', '375mg Tablet', '625mg Tablet', '1g Tablet', '600mg IV Injection', '1.2g IV Injection', 'ES-600 Suspension 100ml', 'Duo 1g Tablet']
  },
  {
    category: 'Antibiotics & Anti-infectives',
    generic: 'Ciprofloxacin',
    brands: ['Cifran', 'Ciprobid', 'Cipromac', 'Cipro (SPMC)', 'Ciproxin', 'Quintor', 'Alcipro', 'Ciproz', 'Zoxan'],
    strengths: ['250mg Tablet', '500mg Tablet', '750mg Tablet', '200mg/100ml IV Infusion', '0.3% Eye/Ear Drops 5ml', '0.3% Eye/Ear Drops 10ml', '0.3% Eye Ointment 5g', '500mg XR Tablet', '1g XR Tablet']
  },
  {
    category: 'Antibiotics & Anti-infectives',
    generic: 'Cefuroxime Axetil',
    brands: ['Zinnat', 'Cetil', 'Ceftum', 'Furox', 'Altacef', 'Cefakind', 'Oratil', 'Ceroxim'],
    strengths: ['125mg/5ml Suspension 50ml', '125mg/5ml Suspension 70ml', '125mg Tablet', '250mg Tablet', '500mg Tablet', '750mg IV Injection', '1.5g IV Injection']
  },
  {
    category: 'Antibiotics & Anti-infectives',
    generic: 'Cefixime',
    brands: ['Cefspan', 'Zifi', 'Taxim-O', 'Omnicef', 'Cef-O', 'Ziprax', 'Hifen', 'Cephalkem'],
    strengths: ['50mg/5ml Suspension 30ml', '100mg/5ml Suspension 30ml', '100mg/5ml Suspension 50ml', '100mg Tablet', '200mg Tablet', '400mg Tablet', '100mg Dispersible Tablet', '200mg Dispersible Tablet', 'OF (Cefixime 200mg + Ofloxacin 200mg)']
  },
  {
    category: 'Antibiotics & Anti-infectives',
    generic: 'Azithromycin',
    brands: ['Zithromax', 'Azithral', 'Azee', 'Azimax', 'Azatril', 'Zady', 'Azicip', 'ATM'],
    strengths: ['100mg/5ml Suspension 15ml', '200mg/5ml Suspension 15ml', '200mg/5ml Suspension 30ml', '250mg Tablet', '500mg Tablet', '1g Tablet', '500mg IV Injection']
  },
  {
    category: 'Antibiotics & Anti-infectives',
    generic: 'Clarithromycin',
    brands: ['Klacid', 'Claribid', 'Clariwin', 'Maclar', 'Synclar', 'Biaxin', 'Claricin'],
    strengths: ['125mg/5ml Granules Suspension 60ml', '250mg/5ml Suspension 60ml', '250mg Tablet', '500mg Tablet', '500mg XL Tablet', '500mg IV Infusion']
  },
  {
    category: 'Antibiotics & Anti-infectives',
    generic: 'Cloxacillin Sodium',
    brands: ['Cloxin', 'Klox', 'Bioclox', 'Cloxacillin (SPMC)', 'Orbenil'],
    strengths: ['125mg/5ml Syrup 60ml', '250mg Capsule', '500mg Capsule', '250mg Injection', '500mg Injection']
  },
  {
    category: 'Antibiotics & Anti-infectives',
    generic: 'Flucloxacillin',
    brands: ['Floxapen', 'Flucil', 'Fluclox', 'Flucloxacillin (SPMC)', 'Staficyn', 'Flubiotic'],
    strengths: ['125mg/5ml Syrup 60ml', '125mg/5ml Syrup 100ml', '250mg Capsule', '500mg Capsule', '1g Tablet', '250mg Injection', '500mg Injection']
  },
  {
    category: 'Antibiotics & Anti-infectives',
    generic: 'Cephalexin',
    brands: ['Sporidex', 'Keflex', 'Phexin', 'Cephadex', 'Cephalexin (SPMC)', 'Alcephin'],
    strengths: ['125mg/5ml Suspension 60ml', '125mg/5ml Suspension 100ml', '250mg/5ml Suspension 60ml', '250mg Capsule', '500mg Capsule', '1g Tablet', '125mg Dispersible Tablet', '250mg Dispersible Tablet']
  },
  {
    category: 'Antibiotics & Anti-infectives',
    generic: 'Metronidazole',
    brands: ['Flagyl', 'Metrogyl', 'Metron', 'Metronidazole (SPMC)', 'Aldezole', 'Entamizole'],
    strengths: ['200mg/5ml Suspension 60ml', '200mg/5ml Suspension 100ml', '200mg Tablet', '400mg Tablet', '500mg Tablet', '500mg/100ml IV Infusion', 'Gel 30g', 'Plus (Metronidazole 400mg + Diloxanide Furoate 500mg)']
  },
  {
    category: 'Antibiotics & Anti-infectives',
    generic: 'Doxycycline',
    brands: ['Doxypal', 'Doxicip', 'Vibramycin', 'Doxy (SPMC)', 'Microdox', 'Doxy-1'],
    strengths: ['100mg Capsule', '100mg Tablet', '50mg Capsule', '100mg Dispersible Tablet']
  },
  {
    category: 'Antibiotics & Anti-infectives',
    generic: 'Ceftriaxone',
    brands: ['Rocephin', 'Monocef', 'Oframax', 'Ceftriaxone (SPMC)', 'Powercef', 'Xone', 'Cefbact'],
    strengths: ['250mg IM/IV Injection', '500mg IM/IV Injection', '1g IM/IV Injection', '2g IV Infusion', 'SB 1.5g (Ceftriaxone 1g + Sulbactam 500mg)']
  },
  {
    category: 'Antibiotics & Anti-infectives',
    generic: 'Levofloxacin',
    brands: ['Tavanic', 'Levaquin', 'Lfloxi', 'Levomac', 'Glevo', 'Levobact', 'Cravit'],
    strengths: ['250mg Tablet', '500mg Tablet', '750mg Tablet', '500mg/100ml IV Infusion', '0.5% Eye Drops 5ml']
  },
  {
    category: 'Antibiotics & Anti-infectives',
    generic: 'Nitrofurantoin',
    brands: ['Furadantin', 'Urifast', 'Niftran', 'Macrodantin', 'Martifur', 'Nifty'],
    strengths: ['50mg Capsule', '100mg Capsule', '100mg SR Tablet', '25mg/5ml Suspension 100ml']
  },

  // --- ANTIFUNGALS & ANTIVIRALS ---
  {
    category: 'Antibiotics & Anti-infectives',
    generic: 'Fluconazole',
    brands: ['Diflucan', 'Forcan', 'Flucos', 'Syscan', 'Fluka', 'Zocon', 'Nuforce'],
    strengths: ['50mg Capsule', '150mg Capsule', '200mg Capsule', '400mg Tablet', '200mg/100ml IV Infusion', '50mg/5ml Suspension 35ml', '0.3% Eye Drops 5ml']
  },
  {
    category: 'Antibiotics & Anti-infectives',
    generic: 'Itraconazole',
    brands: ['Sporanox', 'Canditral', 'Itracip', 'Candiforce', 'Itaspor', 'Itral'],
    strengths: ['100mg Capsule', '200mg Capsule', 'SB 50mg Capsule', 'SB 100mg Capsule', 'Oral Solution 10mg/ml 150ml']
  },
  {
    category: 'Antibiotics & Anti-infectives',
    generic: 'Acyclovir',
    brands: ['Zovirax', 'Acivir', 'Herperax', 'Acyclovir (SPMC)', 'Cyclovax', 'Zoral'],
    strengths: ['200mg Tablet', '400mg Tablet', '800mg Tablet', '200mg/5ml Suspension 125ml', '5% Cream 5g', '5% Cream 10g', '3% Eye Ointment 4.5g', '250mg IV Injection', '500mg IV Injection']
  },

  // --- CARDIOVASCULAR & ANTIHYPERTENSIVES ---
  {
    category: 'Cardiovascular & Antihypertensive',
    generic: 'Amlodipine Besylate',
    brands: ['Norvasc', 'Amlip', 'Amcard', 'Amlopres', 'Amlodac', 'Stamlo', 'Amlodipine (SPMC)', 'Camlodin'],
    strengths: ['2.5mg Tablet', '5mg Tablet', '10mg Tablet', 'AT (Amlodipine 5mg + Atenolol 50mg)', 'L (Amlodipine 5mg + Losartan 50mg)', 'V (Amlodipine 5mg + Valsartan 80mg)', 'T (Amlodipine 5mg + Telmisartan 40mg)']
  },
  {
    category: 'Cardiovascular & Antihypertensive',
    generic: 'Losartan Potassium',
    brands: ['Cozaar', 'Losar', 'Zaart', 'Repace', 'Losacar', 'Tozaar', 'Losartan (SPMC)', 'Covance'],
    strengths: ['25mg Tablet', '50mg Tablet', '100mg Tablet', 'H 50/12.5mg (Losartan 50mg + HCTZ 12.5mg)', 'H 100/25mg (Losartan 100mg + HCTZ 25mg)', 'AM (Losartan 50mg + Amlodipine 5mg)']
  },
  {
    category: 'Cardiovascular & Antihypertensive',
    generic: 'Telmisartan',
    brands: ['Micardis', 'Telma', 'Telpres', 'Creser', 'Telmikem', 'Telsartan', 'Arbitel'],
    strengths: ['20mg Tablet', '40mg Tablet', '80mg Tablet', 'H 40/12.5mg (Telmisartan 40mg + HCTZ 12.5mg)', 'H 80/12.5mg Tablet', 'AM (Telmisartan 40mg + Amlodipine 5mg)', 'AMH (Telmisartan 40mg + Amlodipine 5mg + HCTZ 12.5mg)']
  },
  {
    category: 'Cardiovascular & Antihypertensive',
    generic: 'Enalapril Maleate',
    brands: ['Renitec', 'Enam', 'Envas', 'Enalapril (SPMC)', 'Nuril', 'Vasotec'],
    strengths: ['2.5mg Tablet', '5mg Tablet', '10mg Tablet', '20mg Tablet', 'H (Enalapril 10mg + HCTZ 25mg)']
  },
  {
    category: 'Cardiovascular & Antihypertensive',
    generic: 'Ramipril',
    brands: ['Cardace', 'Tritace', 'Ramipres', 'Hopace', 'Ramistar', 'Corpril'],
    strengths: ['1.25mg Tablet', '2.5mg Capsule', '5mg Tablet', '10mg Tablet', 'H (Ramipril 5mg + HCTZ 12.5mg)', 'A (Ramipril 5mg + Amlodipine 5mg)']
  },
  {
    category: 'Cardiovascular & Antihypertensive',
    generic: 'Bisoprolol Fumarate',
    brands: ['Concor', 'Bisocard', 'Bisohexal', 'Corbis', 'Bisotab', 'Zebeta'],
    strengths: ['1.25mg Tablet', '2.5mg Tablet', '5mg Tablet', '10mg Tablet', 'AM 5/5mg (Bisoprolol 5mg + Amlodipine 5mg)', 'Plus (Bisoprolol 5mg + HCTZ 12.5mg)']
  },
  {
    category: 'Cardiovascular & Antihypertensive',
    generic: 'Atenolol',
    brands: ['Tenormin', 'Betacard', 'Atenova', 'Atenolol (SPMC)', 'Atcard', 'Altol'],
    strengths: ['25mg Tablet', '50mg Tablet', '100mg Tablet', 'D (Atenolol 50mg + Chlorthalidone 12.5mg)']
  },
  {
    category: 'Cardiovascular & Antihypertensive',
    generic: 'Carvedilol',
    brands: ['Dilatrend', 'Cardivas', 'Carvil', 'Carca', 'Carloc'],
    strengths: ['3.125mg Tablet', '6.25mg Tablet', '12.5mg Tablet', '25mg Tablet', 'CR 10mg Capsule', 'CR 20mg Capsule']
  },
  {
    category: 'Cardiovascular & Antihypertensive',
    generic: 'Diltiazem Hydrochloride',
    brands: ['Dilzem', 'Herbesser', 'Dilgard', 'Diltiazem (SPMC)', 'Cardizem', 'Angizem'],
    strengths: ['30mg Tablet', '60mg Tablet', '90mg SR Tablet', '120mg SR Tablet', '180mg CD Capsule', '240mg CD Capsule', '25mg Injection']
  },
  {
    category: 'Cardiovascular & Antihypertensive',
    generic: 'Furosemide',
    brands: ['Lasix', 'Frusid', 'Furosemide (SPMC)', 'Salurin', 'Uremide'],
    strengths: ['20mg Tablet', '40mg Tablet', '80mg Tablet', '20mg/2ml Injection', '10mg/ml Oral Solution 60ml']
  },
  {
    category: 'Cardiovascular & Antihypertensive',
    generic: 'Spironolactone',
    brands: ['Aldactone', 'Spirotone', 'Spilact', 'Aldostix', 'Verospiron'],
    strengths: ['25mg Tablet', '50mg Tablet', '100mg Tablet', 'Plus (Spironolactone 50mg + Furosemide 20mg Tablet)']
  },
  {
    category: 'Cardiovascular & Antihypertensive',
    generic: 'Hydrochlorothiazide',
    brands: ['Aquazide', 'Esidrex', 'Hydrazide', 'HCTZ (SPMC)'],
    strengths: ['12.5mg Tablet', '25mg Tablet', '50mg Tablet']
  },
  {
    category: 'Cardiovascular & Antihypertensive',
    generic: 'Glyceryl Trinitrate (GTN)',
    brands: ['Angised', 'Nitroglycerin', 'Nitrocontin', 'Nitromint', 'Sorbitrate'],
    strengths: ['0.5mg Sublingual Tablet', '2.6mg CR Tablet', '6.4mg CR Tablet', '400mcg/dose Sublingual Spray', '5mg/ml Injection 10ml', '5mg Transdermal Patch']
  },

  // --- LIPID LOWERING & ANTICOAGULANTS ---
  {
    category: 'Lipid Lowering & Anticoagulants',
    generic: 'Atorvastatin Calcium',
    brands: ['Lipitor', 'Atorva', 'Atocor', 'Storvas', 'Lipicure', 'Atorvastatin (SPMC)', 'Tonact', 'Astin'],
    strengths: ['5mg Tablet', '10mg Tablet', '20mg Tablet', '40mg Tablet', '80mg Tablet', 'EZ (Atorvastatin 10mg + Ezetimibe 10mg)', 'EZ 20 (Atorvastatin 20mg + Ezetimibe 10mg)', 'F (Atorvastatin 10mg + Fenofibrate 145mg)']
  },
  {
    category: 'Lipid Lowering & Anticoagulants',
    generic: 'Rosuvastatin',
    brands: ['Crestor', 'Rosuvas', 'Rozucor', 'Roseday', 'Rosulip', 'Novastat', 'Rosave'],
    strengths: ['5mg Tablet', '10mg Tablet', '20mg Tablet', '40mg Tablet', 'F (Rosuvastatin 10mg + Fenofibrate 160mg)', 'EZ (Rosuvastatin 10mg + Ezetimibe 10mg)']
  },
  {
    category: 'Lipid Lowering & Anticoagulants',
    generic: 'Fenofibrate',
    brands: ['Lipicard', 'Tricor', 'Fibrocet', 'Stanlip', 'Fenolip'],
    strengths: ['67mg Micronised Capsule', '145mg Tablet', '160mg Tablet', '200mg Micronised Capsule']
  },
  {
    category: 'Lipid Lowering & Anticoagulants',
    generic: 'Clopidogrel',
    brands: ['Plavix', 'Clopilet', 'Deplatt', 'Clavix', 'Clopivas', 'Noklot', 'Ceruvit'],
    strengths: ['75mg Tablet', '150mg Tablet', '300mg Loading Tablet', 'A 75 (Clopidogrel 75mg + Aspirin 75mg)', 'A 150 (Clopidogrel 75mg + Aspirin 150mg)']
  },
  {
    category: 'Lipid Lowering & Anticoagulants',
    generic: 'Aspirin (Cardio)',
    brands: ['Cardiprin', 'Ecosprin', 'Disprin Cardio', 'Aspirin Cardio', 'Loprin', 'ASA (SPMC)'],
    strengths: ['75mg Enteric Coated Tablet', '100mg Enteric Coated Tablet', '150mg Enteric Coated Tablet', '100mg Soluble Tablet', '300mg Soluble Tablet']
  },
  {
    category: 'Lipid Lowering & Anticoagulants',
    generic: 'Warfarin Sodium',
    brands: ['Marevan', 'Coumadin', 'Warf', 'Uniwarfin'],
    strengths: ['1mg Tablet', '2.5mg Tablet', '3mg Tablet', '5mg Tablet']
  },
  {
    category: 'Lipid Lowering & Anticoagulants',
    generic: 'Rivaroxaban',
    brands: ['Xarelto', 'Rivaroz', 'Rixaban', 'Xarator', 'Rovactor'],
    strengths: ['2.5mg Tablet', '10mg Tablet', '15mg Tablet', '20mg Tablet']
  },

  // --- DIABETES & ENDOCRINE ---
  {
    category: 'Diabetes & Endocrine',
    generic: 'Metformin Hydrochloride',
    brands: ['Glucophage', 'Cetapin', 'Glycomet', 'Metfor', 'Metformin (SPMC)', 'Formet', 'Obimet', 'Walaphage'],
    strengths: ['500mg Tablet', '850mg Tablet', '1000mg Tablet', 'XR 500mg Tablet', 'XR 750mg Tablet', 'XR 1000mg Tablet']
  },
  {
    category: 'Diabetes & Endocrine',
    generic: 'Gliclazide',
    brands: ['Diamicron', 'Glygard', 'Reclide', 'Gliclazide (SPMC)', 'Glizid', 'Diapro'],
    strengths: ['40mg Tablet', '80mg Tablet', 'MR 30mg Modified Release Tablet', 'MR 60mg Modified Release Tablet', 'M (Gliclazide 80mg + Metformin 500mg)']
  },
  {
    category: 'Diabetes & Endocrine',
    generic: 'Glimepiride',
    brands: ['Amaryl', 'Glimy', 'Zoryl', 'Gemer', 'Glimda', 'Diapride', 'Euglim'],
    strengths: ['1mg Tablet', '2mg Tablet', '3mg Tablet', '4mg Tablet', 'M1 (Glimepiride 1mg + Metformin 500mg)', 'M2 (Glimepiride 2mg + Metformin 500mg)', 'MF 2 (Glimepiride 2mg + Metformin 1000mg)']
  },
  {
    category: 'Diabetes & Endocrine',
    generic: 'Sitagliptin',
    brands: ['Januvia', 'Istavel', 'Zita', 'Janumet', 'Sitaglu'],
    strengths: ['25mg Tablet', '50mg Tablet', '100mg Tablet', '50/500mg (Sitagliptin 50mg + Metformin 500mg)', '50/1000mg (Sitagliptin 50mg + Metformin 1000mg)', 'XR 50/1000mg Tablet']
  },
  {
    category: 'Diabetes & Endocrine',
    generic: 'Vildagliptin',
    brands: ['Galvus', 'Jalra', 'Zomelis', 'Vildaprime', 'Galvus Met', 'Vildamac'],
    strengths: ['50mg Tablet', '50/500mg (Vildagliptin 50mg + Metformin 500mg)', '50/850mg (Vildagliptin 50mg + Metformin 850mg)', '50/1000mg (Vildagliptin 50mg + Metformin 1000mg)']
  },
  {
    category: 'Diabetes & Endocrine',
    generic: 'Dapagliflozin',
    brands: ['Forxiga', 'Oxra', 'Dapavel', 'Dapaone', 'Bexiglu', 'Dapaglyn'],
    strengths: ['5mg Tablet', '10mg Tablet', 'M 10/500mg (Dapagliflozin 10mg + Metformin 500mg)', 'M 10/1000mg (Dapagliflozin 10mg + Metformin 1000mg)']
  },
  {
    category: 'Diabetes & Endocrine',
    generic: 'Empagliflozin',
    brands: ['Jardiance', 'Gibtulio', 'Empaglyn', 'Jardiance Duo', 'Embeta'],
    strengths: ['10mg Tablet', '25mg Tablet', '12.5/500mg (Empagliflozin 12.5mg + Metformin 500mg)', '12.5/1000mg (Empagliflozin 12.5mg + Metformin 1000mg)']
  },
  {
    category: 'Diabetes & Endocrine',
    generic: 'Levothyroxine Sodium',
    brands: ['Eltroxin', 'Thyronorm', 'Thyrox', 'Thyrosit', 'Levotiroxina'],
    strengths: ['25mcg Tablet', '50mcg Tablet', '75mcg Tablet', '88mcg Tablet', '100mcg Tablet', '125mcg Tablet', '150mcg Tablet']
  },
  {
    category: 'Diabetes & Endocrine',
    generic: 'Prednisolone',
    brands: ['Prednisolone (SPMC)', 'Wysolone', 'Deltacortril', 'Omnacortil', 'Predmet'],
    strengths: ['5mg Tablet', '10mg Tablet', '20mg Tablet', '5mg/5ml Syrup 60ml', '5mg/5ml Syrup 100ml', '0.5% Eye Drops 5ml', '1% Eye Drops 5ml']
  },
  {
    category: 'Diabetes & Endocrine',
    generic: 'Dexamethasone',
    brands: ['Dexona', 'Decadron', 'Dexamethasone (SPMC)', 'Demisone', 'Dexa'],
    strengths: ['0.5mg Tablet', '1mg Tablet', '2mg Tablet', '4mg/ml Injection 2ml', '8mg/2ml Injection', '0.1% Eye/Ear Drops 5ml']
  },

  // --- GASTROINTESTINAL & ANTI-ULCERANTS ---
  {
    category: 'Gastrointestinal & Anti-Ulcerant',
    generic: 'Omeprazole',
    brands: ['Losec', 'Omez', 'Ocid', 'Omeprazole (SPMC)', 'Omee', 'Omepra', 'Proceptin', 'Gasec'],
    strengths: ['10mg Capsule', '20mg Capsule', '40mg Capsule', '40mg IV Injection', 'D (Omeprazole 20mg + Domperidone 10mg Capsule)', 'DSR (Omeprazole 20mg + Domperidone 30mg SR Capsule)']
  },
  {
    category: 'Gastrointestinal & Anti-Ulcerant',
    generic: 'Pantoprazole',
    brands: ['Pantocid', 'Pan', 'Pantop', 'Pantosec', 'Protium', 'Panto (SPMC)', 'Pentab'],
    strengths: ['20mg Enteric Coated Tablet', '40mg Enteric Coated Tablet', '40mg IV Injection', 'D (Pantoprazole 40mg + Domperidone 10mg)', 'DSR (Pantoprazole 40mg + Domperidone 30mg SR)', 'L (Pantoprazole 40mg + Levosulpiride 75mg SR)']
  },
  {
    category: 'Gastrointestinal & Anti-Ulcerant',
    generic: 'Esomeprazole',
    brands: ['Nexium', 'Nexpro', 'Esomac', 'Esomefol', 'Izra', 'Raciper'],
    strengths: ['20mg Tablet', '40mg Tablet', '40mg IV Injection', 'DSR (Esomeprazole 40mg + Domperidone 30mg SR)', '10mg Sachet Granules 28s']
  },
  {
    category: 'Gastrointestinal & Anti-Ulcerant',
    generic: 'Rabeprazole Sodium',
    brands: ['Pariet', 'Rablet', 'Razo', 'Cyra', 'Happi', 'Rabicip'],
    strengths: ['10mg Tablet', '20mg Tablet', '20mg IV Injection', 'DSR (Rabeprazole 20mg + Domperidone 30mg SR)', 'L (Rabeprazole 20mg + Levosulpiride 75mg)']
  },
  {
    category: 'Gastrointestinal & Anti-Ulcerant',
    generic: 'Domperidone',
    brands: ['Motilium', 'Domstal', 'Vomidome', 'Domperidone (SPMC)', 'Domper', 'Motinorm'],
    strengths: ['10mg Tablet', '10mg/5ml Suspension 60ml', '1mg/ml Drops 30ml', '30mg SR Capsule', '10mg Suppository', '30mg Suppository']
  },
  {
    category: 'Gastrointestinal & Anti-Ulcerant',
    generic: 'Ondansetron',
    brands: ['Zofran', 'Emeset', 'Ondamac', 'Vomigo', 'Ondem', 'Periset'],
    strengths: ['4mg Tablet', '8mg Tablet', '4mg Orally Disintegrating Tablet (ODT)', '8mg ODT', '2mg/5ml Syrup 30ml', '2mg/ml Injection 2ml', '2mg/ml Injection 4ml']
  },
  {
    category: 'Gastrointestinal & Anti-Ulcerant',
    generic: 'Hyoscine Butylbromide',
    brands: ['Buscopan', 'Spasmopan', 'Hyocimax', 'Hyoscine (SPMC)', 'Colicnil'],
    strengths: ['10mg Tablet', '20mg/ml Injection 1ml', 'Plus (Hyoscine 10mg + Paracetamol 500mg Tablet)']
  },
  {
    category: 'Gastrointestinal & Anti-Ulcerant',
    generic: 'Lactulose',
    brands: ['Duphalac', 'Lactul', 'Looz', 'Laxit', 'Evict', 'Dulac'],
    strengths: ['3.3g/5ml Solution 100ml', '3.3g/5ml Solution 150ml', '3.3g/5ml Solution 200ml', '3.3g/5ml Solution 500ml']
  },
  {
    category: 'Gastrointestinal & Anti-Ulcerant',
    generic: 'Oral Rehydration Salts (ORS)',
    brands: ['Jeewani', 'Electral', 'W.H.O. ORS', 'Electrokind', 'Peditral', 'Hydralite'],
    strengths: ['Sachet 4.2g (for 200ml)', 'Sachet 20.5g (for 1L)', 'Orange Flavor Sachet 21.8g', 'Apple Flavor Ready Drink 200ml', 'Lemon Flavor Sachet 21.8g']
  },
  {
    category: 'Gastrointestinal & Anti-Ulcerant',
    generic: 'Antacid Suspensions / Tablets',
    brands: ['Digene', 'Gelusil', 'Mucaine', 'Gaviscon Double Action', 'Gaviscon Original', 'Asilone', 'Aludrox', 'Mylanta'],
    strengths: ['Liquid Mint Flavor 200ml', 'Liquid Orange Flavor 200ml', 'Gel Mixed Fruit 200ml', 'Liquid Aniseed 150ml', 'Liquid Aniseed 300ml', 'Chewable Tablet Mint (10s)', 'Chewable Tablet Orange (10s)', 'Double Action Liquid Sachet 10ml']
  },

  // --- RESPIRATORY & ANTIHISTAMINES ---
  {
    category: 'Respiratory & Antihistamines',
    generic: 'Salbutamol',
    brands: ['Ventolin', 'Asthalin', 'Salbair', 'Salbutamol (SPMC)', 'Aerolin'],
    strengths: ['100mcg Evohaler (200 actuations)', '2mg Tablet', '4mg Tablet', '2mg/5ml Syrup 60ml', '2mg/5ml Syrup 100ml', '2.5mg/2.5ml Respules (Nebuliser Liquid)', '5mg/2.5ml Respules']
  },
  {
    category: 'Respiratory & Antihistamines',
    generic: 'Cetirizine Hydrochloride',
    brands: ['Zyrtec', 'Alerid', 'Cetzine', 'Alatrol', 'Cetirizine (SPMC)', 'Okacet', 'Incid-L'],
    strengths: ['5mg/5ml Syrup 60ml', '5mg/5ml Syrup 100ml', '10mg Tablet', '10mg Dispersible Tablet', '10mg/ml Oral Drops 15ml', 'D (Cetirizine 5mg + Pseudoephedrine 120mg)']
  },
  {
    category: 'Respiratory & Antihistamines',
    generic: 'Fexofenadine Hydrochloride',
    brands: ['Allegra', 'Fexet', 'Telfast', 'Fexova', 'Fexofen', 'Alertop'],
    strengths: ['30mg/5ml Suspension 60ml', '30mg Tablet', '60mg Tablet', '120mg Tablet', '180mg Tablet', 'D (Fexofenadine 60mg + Pseudoephedrine 120mg)']
  },
  {
    category: 'Respiratory & Antihistamines',
    generic: 'Montelukast Sodium',
    brands: ['Singulair', 'Montair', 'Montek', 'Telekast', 'Montina', 'Romilast', 'Airway'],
    strengths: ['4mg Chewable Tablet', '4mg Granules Sachet 0.5g', '5mg Chewable Tablet', '10mg Film Coated Tablet', 'LC (Montelukast 10mg + Levocetirizine 5mg)', 'FX (Montelukast 10mg + Fexofenadine 120mg)']
  },
  {
    category: 'Respiratory & Antihistamines',
    generic: 'Chlorpheniramine Maleate',
    brands: ['Piriton', 'CPM (SPMC)', 'Allermin', 'Chlorhist', 'Zeet'],
    strengths: ['2mg/5ml Syrup 60ml', '2mg/5ml Syrup 100ml', '4mg Tablet', '10mg/ml Injection 1ml']
  },
  {
    category: 'Respiratory & Antihistamines',
    generic: 'Levocetirizine',
    brands: ['Xyzal', 'Vozet', 'Levocet', '1-AL', 'L-Hist', 'Cetcip-L'],
    strengths: ['2.5mg/5ml Syrup 60ml', '5mg Tablet', '5mg/ml Drops 15ml']
  },
  {
    category: 'Respiratory & Antihistamines',
    generic: 'Fluticasone Propionate (Nasal / Inhaler)',
    brands: ['Flixonase', 'Avamys', 'Flovent', 'Flomist', 'Ezinas'],
    strengths: ['50mcg Nasal Spray (120 sprays)', '27.5mcg Furoate Nasal Spray (120 sprays)', '125mcg Inhaler (120 doses)', '250mcg Inhaler (120 doses)']
  },
  {
    category: 'Respiratory & Antihistamines',
    generic: 'Ambroxol Hydrochloride',
    brands: ['Mucosolvan', 'Ambril', 'Ambrodil', 'Mucolite', 'Ambrolite'],
    strengths: ['15mg/5ml Syrup 60ml', '30mg/5ml Syrup 100ml', '30mg Tablet', '75mg SR Capsule']
  },
  {
    category: 'Respiratory & Antihistamines',
    generic: 'Xylometazoline Hydrochloride',
    brands: ['Otrivin', 'Xylomet', 'Nasivion', 'Sinarest Nasal', 'Decon'],
    strengths: ['0.05% Paediatric Nasal Drops 10ml', '0.1% Adult Nasal Drops 10ml', '0.1% Adult Nasal Spray 10ml', 'Moisturising Nasal Spray 10ml']
  },

  // --- CENTRAL NERVOUS SYSTEM ---
  {
    category: 'Central Nervous System',
    generic: 'Pregabalin',
    brands: ['Lyrica', 'Pregabid', 'Pregeb', 'Gabamax', 'Maxgalin', 'Pregalin', 'Neurokem'],
    strengths: ['50mg Capsule', '75mg Capsule', '100mg Capsule', '150mg Capsule', '300mg Capsule', 'M 75 (Pregabalin 75mg + Methylcobalamin 750mcg)']
  },
  {
    category: 'Central Nervous System',
    generic: 'Gabapentin',
    brands: ['Neurontin', 'Gabapin', 'Gabantip', 'Pentaneuron', 'Gaba (SPMC)'],
    strengths: ['100mg Capsule', '300mg Capsule', '400mg Capsule', '600mg Tablet', 'M (Gabapentin 300mg + Methylcobalamin 500mcg)']
  },
  {
    category: 'Central Nervous System',
    generic: 'Amitriptyline Hydrochloride',
    brands: ['Elavil', 'Tryptomer', 'Saroten', 'Amitriptyline (SPMC)', 'Amiline'],
    strengths: ['10mg Tablet', '25mg Tablet', '50mg Tablet', '75mg Tablet']
  },
  {
    category: 'Central Nervous System',
    generic: 'Escitalopram',
    brands: ['Cipralex', 'Nexito', 'Esdepp', 'Stalopam', 'Escipram', 'Cilentra'],
    strengths: ['5mg Tablet', '10mg Tablet', '20mg Tablet', 'Plus (Escitalopram 10mg + Clonazepam 0.5mg)']
  },
  {
    category: 'Central Nervous System',
    generic: 'Sertraline',
    brands: ['Zoloft', 'Sertacide', 'Daxid', 'Serta', 'Serlift'],
    strengths: ['25mg Tablet', '50mg Tablet', '100mg Tablet']
  },
  {
    category: 'Central Nervous System',
    generic: 'Clonazepam',
    brands: ['Rivotril', 'Clonapik', 'Lonazep', 'Klonopin', 'Zapiz'],
    strengths: ['0.25mg Mouth Dissolving Tablet', '0.5mg Tablet', '1mg Tablet', '2mg Tablet', '2.5mg/ml Drops 10ml']
  },

  // --- DERMATOLOGY & TOPICALS ---
  {
    category: 'Dermatology & Topicals',
    generic: 'Betamethasone Valerate / Dipropionate',
    brands: ['Betnovate', 'Diprosone', 'Betasone', 'Betagel', 'Betaderm'],
    strengths: ['0.1% Cream 15g', '0.1% Cream 30g', '0.1% Ointment 15g', '0.1% Ointment 30g', '0.1% Scalp Lotion 30ml', 'C (with Clioquinol 3%) 15g', 'N (with Neomycin 0.5%) 15g', 'N (with Neomycin 0.5%) 30g', 'GM (with Gentamicin + Miconazole) 20g']
  },
  {
    category: 'Dermatology & Topicals',
    generic: 'Hydrocortisone',
    brands: ['Cortopin', 'Hycort', 'Efcortelan', 'Hydrocortisone (SPMC)', 'Locoid'],
    strengths: ['1% Cream 15g', '1% Cream 30g', '1% Ointment 15g', '100mg IV Injection', '0.1% Butyrate Lipocream 30g']
  },
  {
    category: 'Dermatology & Topicals',
    generic: 'Fusidic Acid',
    brands: ['Fucidin', 'Foban', 'Bactafuz', 'Fusid', 'Fudic'],
    strengths: ['2% Cream 15g', '2% Ointment 15g', 'H (Fusidic Acid 2% + Hydrocortisone 1% Cream 15g)', 'B (Fusidic Acid 2% + Betamethasone 0.1% Cream 15g)']
  },
  {
    category: 'Dermatology & Topicals',
    generic: 'Clotrimazole',
    brands: ['Canesten', 'Candid', 'Clofranil', 'Clotrimazole (SPMC)', 'Mycelex'],
    strengths: ['1% Cream 20g', '1% Cream 50g', '1% Powder 75g', '1% Powder 100g', '1% Mouth Paint 15ml', '100mg Vaginal Tablet (6s)', '500mg Single Dose Vaginal Pessary', 'B (Clotrimazole 1% + Beclomethasone 0.025% Cream 15g)']
  },
  {
    category: 'Dermatology & Topicals',
    generic: 'Silver Sulfadiazine',
    brands: ['Silvazine', 'Silvadene', 'Burnheal', 'Silverex', 'Dermazin'],
    strengths: ['1% Burn Cream 25g', '1% Burn Cream 50g', '1% Burn Cream 250g Jar', '1% Burn Cream 500g Jar']
  },

  // --- OPHTHALMIC & ENT PREPARATIONS ---
  {
    category: 'Ophthalmic & ENT Preparations',
    generic: 'Chloramphenicol',
    brands: ['Chloromycetin', 'Optichlor', 'Chloramphenicol (SPMC)', 'Alclor'],
    strengths: ['0.5% Eye Drops 10ml', '1% Eye Ointment 4g', '5% Ear Drops 10ml', 'Applicaps (Eye Capsules 100s)']
  },
  {
    category: 'Ophthalmic & ENT Preparations',
    generic: 'Tobramycin',
    brands: ['Tobrex', 'Tobacin', 'Tobacip', 'Tobracid'],
    strengths: ['0.3% Eye Drops 5ml', '0.3% Eye Ointment 3.5g', 'DM (with Dexamethasone 0.1%) Eye Drops 5ml', 'DM Eye Ointment 3.5g']
  },
  {
    category: 'Ophthalmic & ENT Preparations',
    generic: 'Lubricant Eye Drops (Artificial Tears)',
    brands: ['Tears Naturale II', 'Refresh Tears', 'Systane Ultra', 'Optive', 'Lacryvisc', 'Cellufresh'],
    strengths: ['0.5% Carboxymethylcellulose Eye Drops 10ml', '0.5% Eye Drops 15ml', '1% Carboxymethylcellulose Eye Drops 10ml', 'Polyethylene Glycol Eye Drops 10ml', 'Eye Gel 10g']
  },

  // --- VITAMINS, MINERALS & NUTRITION ---
  {
    category: 'Vitamins, Minerals & Nutrition',
    generic: 'Vitamin C (Ascorbic Acid)',
    brands: ['Cebion', 'Redoxon', 'C-Vite', 'Ascoril C', 'Cecon', 'C-Lim', 'Sukcee'],
    strengths: ['100mg Chewable Tablet (Orange)', '500mg Chewable Tablet (Orange)', '500mg Chewable Tablet (Lemon)', '1000mg Effervescent Tablet (10s)', '1000mg Effervescent Tablet (15s)', '100mg/5ml Drops 30ml']
  },
  {
    category: 'Vitamins, Minerals & Nutrition',
    generic: 'Vitamin B Complex + B12',
    brands: ['Neurobion', 'Becodex', 'Polybion', 'B-Neurone', 'Neurofenac', 'Becosules', 'Surbex-T'],
    strengths: ['Forte Tablet (10s)', 'Forte Tablet (30s)', 'Forte Tablet (100s)', 'Syrup 100ml', 'Syrup 200ml', '5000mcg Injection 3ml', 'Z (B-Complex with Zinc Capsule 30s)']
  },
  {
    category: 'Vitamins, Minerals & Nutrition',
    generic: 'Vitamin D3 (Cholecalciferol)',
    brands: ['Cal-D3', 'D-Rise', 'Ostocalcium', 'Arachitol', 'Ultra D3', 'DV 60K'],
    strengths: ['1000 IU Tablet', '2000 IU Tablet', '5000 IU Capsule', '60,000 IU Capsule (4s)', '60,000 IU Oral Solution Sachet 5ml', '300,000 IU Injection 1ml', '600,000 IU Injection 1ml', '400 IU/ml Drops 15ml']
  },
  {
    category: 'Vitamins, Minerals & Nutrition',
    generic: 'Calcium + Vitamin D',
    brands: ['Caltrate', 'Coral Cal D', 'Shelcal', 'Cal-C-Vita', 'Calcimax', 'Ostocal D'],
    strengths: ['500mg/400IU Tablet (30s)', '500mg/400IU Tablet (60s)', '500mg/400IU Tablet (100s)', '1250mg Tablet', 'Suspension 200ml', 'Effervescent Tablet (10s)']
  },
  {
    category: 'Vitamins, Minerals & Nutrition',
    generic: 'Iron + Folic Acid',
    brands: ['Fefol', 'Irospan', 'Autrin', 'Ferovit', 'Hb-Total', 'Feroglobin', 'Dexorange'],
    strengths: ['Spansule Capsule (30s)', 'Spansule Capsule (100s)', 'Syrup 150ml', 'Syrup 200ml', 'Drops 30ml', 'Z (with Zinc) Capsule 30s', 'Folic Acid 5mg Tablet (100s)']
  },
  {
    category: 'Vitamins, Minerals & Nutrition',
    generic: 'Multivitamins & Health Supplements',
    brands: ['Pharmaton', 'Wellman', 'Wellwoman', 'Supradyn', 'Centrum', 'Seven Seas Cod Liver Oil', 'Omega-3 Fish Oil', 'Ensure Complete', 'Glucerna SR', 'Sustagen'],
    strengths: ['Capsules (30s)', 'Capsules (60s)', 'Capsules (100s)', 'Vanilla Powder 400g Tin', 'Vanilla Powder 850g Tin', 'Chocolate Powder 400g Tin', 'Liquid 200ml', '1000mg Omega-3 Softgel (60s)', '500mg Cod Liver Oil (100s)', 'Plus Ginseng 30s']
  },

  // --- SURGICAL, DIAGNOSTICS & MEDICAL DEVICES ---
  {
    category: 'Surgical & Medical Devices',
    generic: 'Disposable Sterile Syringe & Needle',
    brands: ['Becton Dickinson (BD)', 'Terumo', 'Nipro', 'Dispovan', 'Lifeline', 'Promed'],
    strengths: ['1ml Tuberculin with 26G Needle', '2ml with 23G Needle', '3ml with 23G Needle', '5ml with 21G Needle', '10ml with 21G Needle', '20ml Luer Lock', '50ml Catheter Tip', 'Insulin Syringe 30U 0.3ml', 'Insulin Syringe 50U 0.5ml', 'Insulin Syringe 100U 1ml']
  },
  {
    category: 'Surgical & Medical Devices',
    generic: 'Gauze, Bandages & Dressing Cotton',
    brands: ['Hansaplast', 'Johnson & Johnson', 'Sterisan', 'Medi-Gauze', 'Smith & Nephew', 'Tegaderm'],
    strengths: ['Surgical Cotton Wool 50g Roll', 'Surgical Cotton Wool 100g Roll', 'Surgical Cotton Wool 250g Roll', 'Surgical Cotton Wool 500g Roll', 'Gauze Bandage 2 Inch x 5 Yards', 'Gauze Bandage 3 Inch x 5 Yards', 'Gauze Bandage 4 Inch x 5 Yards', 'Gauze Bandage 6 Inch x 5 Yards', 'Sterile Gauze Swabs 2x2 Inch (Pack of 5)', 'Sterile Gauze Swabs 3x3 Inch (Pack of 5)', 'Sterile Gauze Swabs 4x4 Inch (Pack of 5)', 'Crepe Bandage 2 Inch (Elastic)', 'Crepe Bandage 3 Inch (Elastic)', 'Crepe Bandage 4 Inch (Elastic)', 'Crepe Bandage 6 Inch (Elastic)', 'Micropore Surgical Tape 0.5 Inch', 'Micropore Surgical Tape 1 Inch', 'Micropore Surgical Tape 2 Inch', 'Adhesive Wound Plasters Strip (100s Box)', 'Waterproof Band-Aid (20s)']
  },
  {
    category: 'Surgical & Medical Devices',
    generic: 'Antiseptic & Disinfectant Solutions',
    brands: ['Dettol', 'Savlon', 'Betadine', 'Surgical Spirit', 'Hydrogen Peroxide', 'Hibiscrub'],
    strengths: ['Dettol Antiseptic Liquid 60ml', 'Dettol Antiseptic Liquid 125ml', 'Dettol Antiseptic Liquid 250ml', 'Dettol Antiseptic Liquid 500ml', 'Dettol Antiseptic Liquid 1 Litre', 'Savlon Antiseptic 100ml', 'Savlon Antiseptic 250ml', 'Savlon Antiseptic 500ml', 'Betadine 10% Solution 50ml', 'Betadine 10% Solution 100ml', 'Betadine 10% Solution 500ml', 'Surgical Spirit 100ml Bottle', 'Surgical Spirit 250ml Bottle', 'Surgical Spirit 500ml Bottle', 'Hydrogen Peroxide 3% 100ml Bottle', 'Hydrogen Peroxide 3% 200ml Bottle', 'Chlorhexidine 4% Surgical Scrub 500ml']
  },
  {
    category: 'Surgical & Medical Devices',
    generic: 'Diagnostics & Monitoring Devices',
    brands: ['Accu-Chek Active', 'Accu-Chek Instant', 'OneTouch Select Plus', 'Omron Healthcare', 'Rossmax', 'Beurer'],
    strengths: ['Blood Glucose Test Strips 25s', 'Blood Glucose Test Strips 50s', 'Blood Glucose Test Strips 100s', 'Sterile Blood Lancets 100s Box', 'Digital Thermometer Oral/Axillary', 'Infrared Forehead Thermometer Non-Contact', 'Digital Blood Pressure Monitor Upper Arm (Automatic)', 'Compressor Nebulizer Machine with Mask Kit', 'Adult Nebuliser Mask with Tubing', 'Paediatric Nebuliser Mask with Tubing', 'Examination Latex Gloves Medium (100s Box)', 'Examination Latex Gloves Large (100s Box)', 'Nitrile Powder-Free Gloves Blue Medium (100s)', '3-Ply Disposable Surgical Face Masks (50s Box)', 'KN95 Protective Face Mask (10s)']
  },

  // --- MOTHER & BABY CARE ---
  {
    category: 'Mother & Baby Care',
    generic: 'Infant Milk Formula & Baby Food',
    brands: ['Nan 1 Optipro', 'Nan 2 Optipro', 'Nan 3 Optipro', 'Lactogen 1', 'Lactogen 2', 'Lactogen 3', 'Similac 1', 'Similac 2', 'Pediasure Complete', 'Anchor PediaPro', 'Pelwatte Baby Milk'],
    strengths: ['400g Tin / BIB Box', '800g Tin', '850g Tin (Vanilla)', '850g Tin (Chocolate)', '400g Refill Pack', '1kg Tin', 'Gentle Pro 400g', 'L.Comfort 400g']
  },
  {
    category: 'Mother & Baby Care',
    generic: 'Baby Toiletries & Daily Hygiene',
    brands: ['Baby Cheramy', 'Khomba Baby', 'Panda Baby', 'Pears Baby', 'Johnson & Johnson Baby'],
    strengths: ['Floral Baby Soap 100g', 'Milk Baby Soap 100g', 'Cologne 100ml', 'Cologne 200ml', 'Baby Shampoo 100ml', 'Baby Shampoo 200ml', 'Baby Cream 100ml Tube', 'Baby Cream 200ml Jar', 'Baby Oil with Pure Mineral 100ml', 'Baby Oil 200ml', 'Nappy Rash Cream 50g', 'Herbal Baby Soap 100g', 'Bedtime Bath 200ml', 'Baby Powder Talc 100g', 'Baby Powder Talc 200g']
  },
  {
    category: 'Mother & Baby Care',
    generic: 'Baby Diapers & Wet Wipes',
    brands: ['Velona Cuddles', 'Drypers Wee Wee Dry', 'Huggies Dry', 'MamyPoko Pants', 'Pampers'],
    strengths: ['Newborn Tape Diapers (28s)', 'Small Tape Diapers (36s)', 'Medium Tape Diapers (44s)', 'Large Tape Diapers (40s)', 'XL Tape Diapers (34s)', 'XXL Tape Diapers (30s)', 'Pant Style Diapers Medium (32s)', 'Pant Style Diapers Large (28s)', 'Pant Style Diapers XL (24s)', 'Pure Water Bamboo Baby Wipes (80 Sheets Pack)', 'Gentle Cleansing Wet Wipes (80s Lid Pack)', 'Single Sachet Wipes (Pack of 3)']
  },

  // --- PERSONAL CARE & AYURVEDIC OTC ---
  {
    category: 'Personal Care & Ayurvedic OTC',
    generic: 'Sri Lankan Ayurvedic Balms & Herbal Remedies',
    brands: ['Siddhalepa Herbal Balm', 'Link Samahan', 'Link Pasangu', 'Asamodagam Spirit', 'Vicks VapoRub', 'Moov Pain Relief', 'Iodex Rapid Action', 'Amrutanjan Yellow', 'Deep Heat Rub'],
    strengths: ['10g Tin', '25g Bottle', '50g Jar', '100g Jar', 'Herbal Inhaler (1 Piece)', 'Pain Relief Spray 50ml', 'Samahan 100% Herbal (10 Sachets)', 'Samahan 100% Herbal (30 Sachets)', 'Samahan 100% Herbal (60 Sachets Box)', 'Samahan 100% Herbal (100 Sachets Dispenser)', 'Amunugama Asamodagam Spirit 100ml', 'Amunugama Asamodagam Spirit 375ml', 'VapoRub 10g Jar', 'VapoRub 25g Jar', 'VapoRub 50g Jar', 'Moov Ointment 25g Tube', 'Moov Ointment 50g Tube', 'Moov Spray 50g Can', 'Iodex Balm 40g Bottle', 'Fast Relief Pain Cream 30g']
  },
  {
    category: 'Personal Care & Ayurvedic OTC',
    generic: 'Adult Incontinence & Feminine Hygiene',
    brands: ['Friends Adult Diapers', 'Tena Slip', 'Seni Standard', 'EVA Wings', 'Fems Comfort', 'Kotex Soft', 'Stayfree Secure'],
    strengths: ['Medium Adult Diapers (10s Pack)', 'Large Adult Diapers (10s Pack)', 'XL Adult Diapers (10s Pack)', 'Underpads 60x90cm (10s Pack)', 'Regular Cottony Soft Sanitary Pads (8s)', 'Super Slim Wings Sanitary Pads (10s)', 'All Night Extra Heavy Flow Pads (8s)', 'Pantyliners Daily Fresh (20s)']
  },
  {
    category: 'Personal Care & Ayurvedic OTC',
    generic: 'Oral Care, Dental & Intimate Health',
    brands: ['Sensodyne', 'Colgate', 'Signal', 'Corsodyl', 'Hexidine', 'Durex', 'Moods', 'KY Jelly'],
    strengths: ['Repair & Protect Toothpaste 100g', 'Rapid Relief Toothpaste 100g', 'Fresh Mint Sensitive Toothpaste 100g', 'Total Clean Mint Toothpaste 120g', 'Complete Care Toothpaste 120g', 'Chlorhexidine 0.2% Mouthwash 150ml', 'Chlorhexidine Mouthwash 300ml', 'Extra Safe Condoms (3s Pack)', 'Featherlite Ultra Thin Condoms (3s Pack)', 'Close Fit Condoms (3s Pack)', 'Mutual Climax Condoms (3s Pack)', 'Pleasure Me Ribbed Condoms (3s Pack)', 'Sterile Lubricating Jelly 50g Tube', 'Sterile Lubricating Jelly 100g Tube']
  }
];

function generate5000Medicines() {
  const items = [];
  const brandNameSet = new Set();
  let barcodeIndex = 1;

  for (const t of drugTemplates) {
    for (const brand of t.brands) {
      for (const strength of t.strengths) {
        const brandName = `${brand} ${strength}`.trim();
        if (!brandNameSet.has(brandName)) {
          brandNameSet.add(brandName);
          items.push({
            brand: brandName,
            generic: t.generic,
            category: t.category,
            barcode: generateEan13(barcodeIndex++)
          });
        }
      }
    }
  }

  const distributors = [
    'SPC', 'SPMC', 'Torrent', 'Sun', 'Cipla', 'GSK', 'Abbott', 'Sanofi', 'Cadila',
    'Intas', 'Alkem', 'Micro', 'Glenmark', 'Mega', 'Hemas', 'Emerchemie', 'Morison',
    'Baurs', 'George Steuart', 'Kalbe', 'Square', 'Beximco', 'Incepta', 'Astrum'
  ];

  const commonMolecules = [
    { cat: 'Analgesics & Antipyretics', gen: 'Paracetamol', prefix: 'PCM' },
    { cat: 'Analgesics & Antipyretics', gen: 'Diclofenac Potassium', prefix: 'Diclo-K' },
    { cat: 'Analgesics & Antipyretics', gen: 'Ketoprofen', prefix: 'Ketogesic' },
    { cat: 'Analgesics & Antipyretics', gen: 'Aspirin', prefix: 'Aspilet' },
    { cat: 'Analgesics & Antipyretics', gen: 'Piroxicam', prefix: 'Pirox' },
    { cat: 'Antibiotics & Anti-infectives', gen: 'Ampicillin', prefix: 'Ampicil' },
    { cat: 'Antibiotics & Anti-infectives', gen: 'Amikacin', prefix: 'Amik' },
    { cat: 'Antibiotics & Anti-infectives', gen: 'Gentamicin', prefix: 'Genticyn' },
    { cat: 'Antibiotics & Anti-infectives', gen: 'Cefotaxime', prefix: 'Taxim' },
    { cat: 'Antibiotics & Anti-infectives', gen: 'Meropenem', prefix: 'Meromac' },
    { cat: 'Antibiotics & Anti-infectives', gen: 'Vancomycin', prefix: 'Vancocin' },
    { cat: 'Antibiotics & Anti-infectives', gen: 'Cotrimoxazole', prefix: 'Bactrim' },
    { cat: 'Cardiovascular & Antihypertensive', gen: 'Nifedipine', prefix: 'Adalat' },
    { cat: 'Cardiovascular & Antihypertensive', gen: 'Valsartan', prefix: 'Diovan' },
    { cat: 'Cardiovascular & Antihypertensive', gen: 'Candesartan', prefix: 'Atacand' },
    { cat: 'Cardiovascular & Antihypertensive', gen: 'Methyldopa', prefix: 'Aldomet' },
    { cat: 'Cardiovascular & Antihypertensive', gen: 'Hydralazine', prefix: 'Apresoline' },
    { cat: 'Cardiovascular & Antihypertensive', gen: 'Lisinopril', prefix: 'Zestril' },
    { cat: 'Cardiovascular & Antihypertensive', gen: 'Indapamide', prefix: 'Natrilix' },
    { cat: 'Cardiovascular & Antihypertensive', gen: 'Propranolol', prefix: 'Inderal' },
    { cat: 'Cardiovascular & Antihypertensive', gen: 'Digoxin', prefix: 'Lanoxin' },
    { cat: 'Lipid Lowering & Anticoagulants', gen: 'Simvastatin', prefix: 'Zocor' },
    { cat: 'Lipid Lowering & Anticoagulants', gen: 'Ticagrelor', prefix: 'Brilinta' },
    { cat: 'Lipid Lowering & Anticoagulants', gen: 'Dabigatran', prefix: 'Pradaxa' },
    { cat: 'Lipid Lowering & Anticoagulants', gen: 'Apixaban', prefix: 'Eliquis' },
    { cat: 'Lipid Lowering & Anticoagulants', gen: 'Enoxaparin Sodium', prefix: 'Clexane' },
    { cat: 'Diabetes & Endocrine', gen: 'Pioglitazone', prefix: 'Pioz' },
    { cat: 'Diabetes & Endocrine', gen: 'Linagliptin', prefix: 'Trajenta' },
    { cat: 'Diabetes & Endocrine', gen: 'Teneligliptin', prefix: 'Ziten' },
    { cat: 'Diabetes & Endocrine', gen: 'Human Regular Insulin', prefix: 'Actrapid' },
    { cat: 'Diabetes & Endocrine', gen: 'Human NPH Insulin', prefix: 'Insulatard' },
    { cat: 'Diabetes & Endocrine', gen: 'Human Biphasic Insulin 30/70', prefix: 'Mixtard 30' },
    { cat: 'Diabetes & Endocrine', gen: 'Insulin Glargine', prefix: 'Lantus' },
    { cat: 'Diabetes & Endocrine', gen: 'Carbimazole', prefix: 'Neo-Mercazole' },
    { cat: 'Diabetes & Endocrine', gen: 'Methylprednisolone', prefix: 'Medrol' },
    { cat: 'Gastrointestinal & Anti-Ulcerant', gen: 'Lansoprazole', prefix: 'Zoton' },
    { cat: 'Gastrointestinal & Anti-Ulcerant', gen: 'Ranitidine', prefix: 'Zantac' },
    { cat: 'Gastrointestinal & Anti-Ulcerant', gen: 'Famotidine', prefix: 'Pepcid' },
    { cat: 'Gastrointestinal & Anti-Ulcerant', gen: 'Sucralfate', prefix: 'Ulcate' },
    { cat: 'Gastrointestinal & Anti-Ulcerant', gen: 'Ursodeoxycholic Acid', prefix: 'Ursocol' },
    { cat: 'Gastrointestinal & Anti-Ulcerant', gen: 'Loperamide', prefix: 'Imodium' },
    { cat: 'Gastrointestinal & Anti-Ulcerant', gen: 'Bisacodyl', prefix: 'Dulcolax' },
    { cat: 'Gastrointestinal & Anti-Ulcerant', gen: 'Mebeverine Hydrochloride', prefix: 'Duspatalin' },
    { cat: 'Respiratory & Antihistamines', gen: 'Budesonide', prefix: 'Pulmicort' },
    { cat: 'Respiratory & Antihistamines', gen: 'Salmeterol + Fluticasone', prefix: 'Seretide' },
    { cat: 'Respiratory & Antihistamines', gen: 'Formoterol + Budesonide', prefix: 'Symbicort' },
    { cat: 'Respiratory & Antihistamines', gen: 'Ipratropium Bromide', prefix: 'Atrovent' },
    { cat: 'Respiratory & Antihistamines', gen: 'Tiotropium Bromide', prefix: 'Spiriva' },
    { cat: 'Respiratory & Antihistamines', gen: 'Loratadine', prefix: 'Claratyne' },
    { cat: 'Respiratory & Antihistamines', gen: 'Desloratadine', prefix: 'Aerius' },
    { cat: 'Respiratory & Antihistamines', gen: 'Hydroxyzine', prefix: 'Atarax' },
    { cat: 'Respiratory & Antihistamines', gen: 'Ketotifen', prefix: 'Zaditen' },
    { cat: 'Respiratory & Antihistamines', gen: 'Bromhexine', prefix: 'Bisolvon' },
    { cat: 'Respiratory & Antihistamines', gen: 'Acetylcysteine', prefix: 'Fluimucil' },
    { cat: 'Central Nervous System', gen: 'Duloxetine', prefix: 'Cymbalta' },
    { cat: 'Central Nervous System', gen: 'Fluoxetine', prefix: 'Prozac' },
    { cat: 'Central Nervous System', gen: 'Paroxetine', prefix: 'Seroxat' },
    { cat: 'Central Nervous System', gen: 'Alprazolam', prefix: 'Xanax' },
    { cat: 'Central Nervous System', gen: 'Lorazepam', prefix: 'Ativan' },
    { cat: 'Central Nervous System', gen: 'Diazepam', prefix: 'Valium' },
    { cat: 'Central Nervous System', gen: 'Sodium Valproate', prefix: 'Epilim' },
    { cat: 'Central Nervous System', gen: 'Carbamazepine', prefix: 'Tegretol' },
    { cat: 'Central Nervous System', gen: 'Levetiracetam', prefix: 'Keppra' },
    { cat: 'Central Nervous System', gen: 'Donepezil', prefix: 'Aricept' },
    { cat: 'Central Nervous System', gen: 'Betahistine', prefix: 'Serc' },
    { cat: 'Central Nervous System', gen: 'Flunarizine', prefix: 'Sibelium' },
    { cat: 'Dermatology & Topicals', gen: 'Mupirocin', prefix: 'Bactroban' },
    { cat: 'Dermatology & Topicals', gen: 'Clobetasol Propionate', prefix: 'Dermovate' },
    { cat: 'Dermatology & Topicals', gen: 'Mometasone Furoate', prefix: 'Elocon' },
    { cat: 'Dermatology & Topicals', gen: 'Ketoconazole', prefix: 'Nizoral' },
    { cat: 'Dermatology & Topicals', gen: 'Terbinafine', prefix: 'Lamisil' },
    { cat: 'Dermatology & Topicals', gen: 'Permethrin', prefix: 'Scaboma' },
    { cat: 'Dermatology & Topicals', gen: 'Calamine + Zinc', prefix: 'Calamine Lotion' },
    { cat: 'Ophthalmic & ENT Preparations', gen: 'Moxifloxacin Eye Drops', prefix: 'Vigamox' },
    { cat: 'Ophthalmic & ENT Preparations', gen: 'Timolol Maleate', prefix: 'Timoptol' },
    { cat: 'Ophthalmic & ENT Preparations', gen: 'Latanoprost', prefix: 'Xalatan' },
    { cat: 'Ophthalmic & ENT Preparations', gen: 'Olopatadine', prefix: 'Patanol' }
  ];

  const standardForms = [
    'Tablet (Pack of 10)',
    'Tablet (Pack of 30)',
    'Tablet (Box of 100)',
    'Capsule (Pack of 10)',
    'Capsule (Box of 100)',
    'Suspension 60ml',
    'Suspension 100ml',
    'Syrup 100ml',
    'Injection 1ml',
    'Injection 2ml'
  ];

  for (const m of commonMolecules) {
    for (const dist of distributors) {
      for (const form of standardForms) {
        if (items.length >= 5000) break;
        const brandName = `${m.prefix} (${dist}) ${form}`;
        if (!brandNameSet.has(brandName)) {
          brandNameSet.add(brandName);
          items.push({
            brand: brandName,
            generic: m.gen,
            category: m.cat,
            barcode: generateEan13(barcodeIndex++)
          });
        }
      }
      if (items.length >= 5000) break;
    }
    if (items.length >= 5000) break;
  }

  let extraCounter = 1;
  while (items.length < 5000) {
    const brandName = `Medical Sundry Item Code-${String(extraCounter).padStart(4, '0')}`;
    if (!brandNameSet.has(brandName)) {
      brandNameSet.add(brandName);
      items.push({
        brand: brandName,
        generic: 'Pharmacy General Retail Sundry',
        category: 'Surgical & Medical Devices',
        barcode: generateEan13(barcodeIndex++)
      });
    }
    extraCounter++;
  }

  return items.slice(0, 5000);
}

// Read current database.js
const dbFilePath = path.join(__dirname, '../src/main/config/database.js');
let content = fs.readFileSync(dbFilePath, 'utf8');

// Ensure barcode columns are in CREATE TABLE statements and migrations
if (!content.includes('barcode TEXT')) {
  content = content.replace(
    'min_stock_alert INTEGER DEFAULT 10\n    );',
    'min_stock_alert INTEGER DEFAULT 10,\n      barcode TEXT\n    );'
  );
  content = content.replace(
    'quantity INTEGER NOT NULL,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,',
    'quantity INTEGER NOT NULL,\n      barcode TEXT,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,'
  );
}

if (!content.includes('ALTER TABLE drugs ADD COLUMN barcode TEXT')) {
  content = content.replace(
    'try { db.exec(`ALTER TABLE batches ADD COLUMN supplier_id INTEGER;`); } catch (e) { }',
    `try { db.exec(\`ALTER TABLE batches ADD COLUMN supplier_id INTEGER;\`); } catch (e) { }
  try { db.exec(\`ALTER TABLE drugs ADD COLUMN barcode TEXT;\`); } catch (e) { }
  try { db.exec(\`ALTER TABLE batches ADD COLUMN barcode TEXT;\`); } catch (e) { }`
  );
}

const items = generate5000Medicines();
console.log('Generated exactly 5,000 items:', items.length);

// Build JS code for commonDrugs array
const jsonEntries = items.map(it => `    { brand: ${JSON.stringify(it.brand)}, generic: ${JSON.stringify(it.generic)}, category: ${JSON.stringify(it.category)}, barcode: ${JSON.stringify(it.barcode)} }`).join(',\n');

const newCommonDrugsBlock = `  const commonDrugs = [\n${jsonEntries}\n  ];\n\n  const insertDrug = db.prepare(\`\n    INSERT INTO drugs (brand_name, generic_name, category, min_stock_alert, barcode)\n    VALUES (?, ?, ?, 10, ?)\n    ON CONFLICT(brand_name) DO UPDATE SET \n      generic_name = excluded.generic_name,\n      category = excluded.category,\n      barcode = COALESCE(excluded.barcode, drugs.barcode)\n  \`);\n\n  const seedTransaction = db.transaction((drugs) => {\n    for (const drug of drugs) {\n      insertDrug.run(drug.brand, drug.generic, drug.category, drug.barcode || null);\n    }\n  });\n\n  seedTransaction(commonDrugs);`;

// Find where commonDrugs starts and ends
const startIdx = content.indexOf('  const commonDrugs = [');
const endMarker = '  seedTransaction(commonDrugs);';
const endIdx = content.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
  const before = content.substring(0, startIdx);
  const after = content.substring(endIdx + endMarker.length);
  const updatedContent = before + newCommonDrugsBlock + after;
  fs.writeFileSync(dbFilePath, updatedContent, 'utf8');
  console.log('Successfully updated src/main/config/database.js with 5,000 items!');
} else {
  console.error('Could not locate commonDrugs block in database.js', { startIdx, endIdx });
}
