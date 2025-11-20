// modules/calculator.js
// Logic การคำนวณต้นทุน, กำไร, และวัสดุ (Pure Functions)

import { bkkZoneMultipliers, provinceMultipliers } from '../data/provinces.js';
import { electricalInstallationData, initialPriceList, mainCableSpecs } from '../data/electrical_data.js';

// สร้าง Map เพื่อค้นหา Task ง่ายๆ
const allTasks = new Map();
const allItems = new Map();
const priceList = JSON.parse(JSON.stringify(initialPriceList)); // Clone เพื่อให้แก้ไขได้

// Init Data Maps
electricalInstallationData.forEach(c => {
    c.tasks.forEach(t => {
        allTasks.set(t.task_id, t);
        t.labor_components?.forEach(l => allItems.set(l.labor_id, { desc: `ค่าแรง: ${t.task_name}`}));
        t.material_components?.forEach(m => allItems.set(m.material_id, { desc: m.spec }));
    });
});

// --- Helper Functions ---

export function getPriceList() {
    return priceList;
}

export function setPrice(id, price) {
    priceList[id] = price;
}

export function getAllItems() {
    return allItems;
}

function getMaterialQuantity(material, taskQuantity) {
    const logic = material.usage_logic;
    if (taskQuantity <= 0) return 0;
    if (!logic) return taskQuantity;

    let qty = 0;
    if (logic.includes('per meter')) {
        const factor = parseFloat(logic.split(' ')[0]);
        qty = taskQuantity * factor;
    } else if (logic.includes('per unit')) {
        const factor = parseFloat(logic.split(' ')[0]);
        qty = taskQuantity * factor;
    } else if (logic.includes('ceil(m/2.92) pipes')) {
        qty = Math.ceil(taskQuantity / 2.92);
    } else if (logic.includes('ceil(m/3.05) pipes')) {
        qty = Math.ceil(taskQuantity / 3.05);
    } else if (logic.includes('ceil(m/2.92)-1 couplings')) {
        qty = Math.max(0, Math.ceil(taskQuantity / 2.92) - 1);
    } else if (logic.includes('ceil(m/3.05)-1 couplings')) {
        qty = Math.max(0, Math.ceil(taskQuantity / 3.05) - 1);
    } else {
        qty = taskQuantity;
    }
    return Math.ceil(qty);
}

export function getMainCableSpec(authority, meterSize, cableType) {
    try {
        const size = mainCableSpecs[authority][meterSize][cableType];
        return size ? size : 0;
    } catch (e) {
        return 0;
    }
}

// --- Main Calculation Function ---
// รับ input: quantities (Map), settings (Object), manualItems (Arrays)
export function calculateProjectCost(taskQuantities, settings, manualPOItems = [], manualBOQItems = []) {
    const results = { labor: [], material: [], combined: [], purchaseOrder: {} };
    
    // Settings Unpacking
    const {
        qualityMultiplier = 1.0,
        wastageFactor = 0,
        overheadFactor = 0,
        profitFactor = 0,
        province = 'default',
        bkkZone = 'BKK_Zone5_Suburban',
        includeVat = false,
        minCharge = 0,
        cableSpecConfig = null // { authority, meterSize, mainType }
    } = settings;

    let totalMaterialCost = 0;
    let totalLaborCost = 0;

    // 1. Loop through standard tasks
    for (const [taskId, quantity] of taskQuantities.entries()) {
        const task = allTasks.get(taskId);
        if (!task || quantity <= 0) continue;

        const isHiddenTask = taskId.startsWith('13.') || taskId === '5.2' || taskId === '7.2';

        let taskTotalMaterial = 0;

        // Material Calculation
        task.material_components?.forEach(mat => {
             // Skip Logic (e.g. Hose exclusion passed via settings if needed, simplified here)
             
             // Special Case: Main Cable
             if (taskId === '17.5' && cableSpecConfig) {
                 const { authority, meterSize, mainType } = cableSpecConfig;
                 const cableSize = getMainCableSpec(authority, meterSize, mainType);
                 
                 if (cableSize > 0) {
                     const cableMatId = `M-CABLE-${mainType}-${cableSize}`;
                     
                     if (mat.material_id === cableMatId) {
                         const matPrice = (priceList[mat.material_id] || 0) * qualityMultiplier;
                         const matQty = getMaterialQuantity(mat, quantity);
                         taskTotalMaterial += (matPrice * matQty * 2); // L,N

                         // Ground Wire
                         const gndMatId = `M-WIRE-GND-10SQMM`;
                         const gndPrice = (priceList[gndMatId] || 0) * qualityMultiplier;
                         taskTotalMaterial += (gndPrice * matQty); 

                         // Add to PO
                         if (!results.purchaseOrder[mat.material_id]) results.purchaseOrder[mat.material_id] = { description: `สายเมน ${mainType} ${cableSize}mm²`, spec: mat.spec, unit: "เมตร", quantity: 0, unit_price: matPrice };
                         if (!results.purchaseOrder[gndMatId]) results.purchaseOrder[gndMatId] = { description: `สายดิน 10mm² (เมน)`, spec: "THW 10mm²", unit: "เมตร", quantity: 0, unit_price: gndPrice };
                         
                         results.purchaseOrder[mat.material_id].quantity += (matQty * 2);
                         results.purchaseOrder[gndMatId].quantity += matQty;
                     }
                 }
             } else {
                 // Normal Material
                 const matPrice = (priceList[mat.material_id] || 0) * qualityMultiplier;
                 const matQty = getMaterialQuantity(mat, quantity);
                 taskTotalMaterial += matPrice * matQty;

                 if (!results.purchaseOrder[mat.material_id]) {
                    results.purchaseOrder[mat.material_id] = { 
                        description: allItems.get(mat.material_id)?.desc || mat.material_id, 
                        spec: mat.spec, unit: "หน่วย", quantity: 0, unit_price: matPrice 
                    };
                }
                results.purchaseOrder[mat.material_id].quantity += matQty;
             }
        });

        // Labor Calculation
        let taskTotalLabor = 0;
        task.labor_components?.forEach(lab => {
            taskTotalLabor += (priceList[lab.labor_id] || 0) * quantity;
        });

        // Special Case: Ground Rod Wire (Task 6.1) - passed via custom logic usually, assumed handled in quantity or simple addition here
        // Note: In V1 this relied on DOM 'ground_distance'. We assume taskQuantities handles '6.1' count, but wire length needs to be passed separately or assumed.
        // For simplicity in refactor, we assume wire cost added via 'manual' or specific task if needed.

        totalMaterialCost += taskTotalMaterial;
        totalLaborCost += taskTotalLabor;

        if (!isHiddenTask) {
            const combinedItem = {
                id: task.task_id, description: task.task_name, quantity: quantity,
                unit: task.unit_of_measure,
                material_unit_cost: (quantity > 0) ? (taskTotalMaterial / quantity) : 0,
                labor_unit_cost: (quantity > 0) ? (taskTotalLabor / quantity) : 0,
            };
            results.labor.push({ ...combinedItem, unit_price: combinedItem.labor_unit_cost, total_price: taskTotalLabor });
            results.material.push({ ...combinedItem, unit_price: combinedItem.material_unit_cost, total_price: taskTotalMaterial });
            results.combined.push(combinedItem);
        }
    }

    // 2. Add Manual Items
    manualPOItems.forEach(item => {
        results.purchaseOrder[item.id] = { ...item };
    });

    manualBOQItems.forEach(item => {
        const taskTotalMaterial = (item.material_unit_cost || 0) * (item.quantity || 0);
        const taskTotalLabor = (item.labor_unit_cost || 0) * (item.quantity || 0);
        totalMaterialCost += taskTotalMaterial;
        totalLaborCost += taskTotalLabor;
        
        const combinedItem = { ...item, material_id_code: '' };
        results.labor.push({ ...combinedItem, unit_price: combinedItem.labor_unit_cost, total_price: taskTotalLabor });
        results.material.push({ ...combinedItem, unit_price: combinedItem.material_unit_cost, total_price: taskTotalMaterial });
        results.combined.push(combinedItem);
    });

    // 3. Apply Location Multipliers
    let provinceMult;
    if (province === 'กรุงเทพมหานคร') {
        provinceMult = bkkZoneMultipliers[bkkZone] || bkkZoneMultipliers['BKK_Zone5_Suburban'];
    } else {
        provinceMult = provinceMultipliers[province] || provinceMultipliers.default;
    }
    totalLaborCost *= provinceMult.labor;
    totalMaterialCost *= provinceMult.material;

    // 4. Final Totals
    results.totalMaterialCost = totalMaterialCost * (1 + wastageFactor);
    results.totalLaborCost = totalLaborCost;
    
    const subTotal = results.totalMaterialCost + results.totalLaborCost;
    results.overheadAmount = subTotal * overheadFactor;
    const subTotalWithOverhead = subTotal + results.overheadAmount;
    results.profitAmount = subTotalWithOverhead * profitFactor;
    results.grandTotal = subTotalWithOverhead + results.profitAmount;

    if (results.grandTotal > 0 && results.grandTotal < minCharge) {
        results.minChargeAdjustment = minCharge - results.grandTotal;
        results.grandTotal = minCharge;
    } else {
        results.minChargeAdjustment = 0;
    }

    results.vatAmount = includeVat ? results.grandTotal * 0.07 : 0;
    results.totalWithVat = results.grandTotal + results.vatAmount;

    return results;
}