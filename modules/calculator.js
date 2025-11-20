import { bkkZoneMultipliers, provinceMultipliers } from '../data/provinces.js';
import { electricalInstallationData, initialPriceList, mainCableSpecs } from '../data/electrical_data.js';

const allTasks = new Map(), allItems = new Map(), priceList = JSON.parse(JSON.stringify(initialPriceList));
electricalInstallationData.forEach(c => c.tasks.forEach(t => { allTasks.set(t.task_id, t); t.labor_components?.forEach(l => allItems.set(l.labor_id, {desc:t.task_name})); t.material_components?.forEach(m => allItems.set(m.material_id, {desc:m.spec})); }));

export function getPriceList() { return priceList; }
export function setPrice(id, p) { priceList[id] = p; }
export function getAllItems() { return allItems; }

export function calculateProjectCost(taskQuantities, settings, manualPO=[], manualBOQ=[]) {
    const res = { labor:[], material:[], combined:[], purchaseOrder:{} };
    const { qualityMultiplier=1, wastageFactor=0, overheadFactor=0, profitFactor=0, province='default', bkkZone='BKK_Zone5_Suburban', includeVat=false, minCharge=0, cableSpecConfig } = settings;
    
    let totalMat = 0, totalLab = 0;
    
    for (const [tid, qty] of taskQuantities.entries()) {
        const t = allTasks.get(tid);
        if(!t || qty<=0) continue;
        let tMat = 0, tLab = 0;
        
        t.material_components?.forEach(m => {
            // Manual Cable Logic
            if (tid === '17.5' && cableSpecConfig) {
                const { mainType, manualSize } = cableSpecConfig;
                const size = manualSize ? parseFloat(manualSize) : 10;
                const mid = `M-CABLE-${mainType}-${size}`;
                if(m.material_id.startsWith('M-CABLE') && !m.material_id.includes(size.toString())) return; // Skip wrong sizes
                if(m.material_id === mid) {
                    const p = (priceList[mid]||0)*qualityMultiplier;
                    const q = qty * 2; // L,N
                    tMat += p*q;
                    // Ground
                    const gP = (priceList['M-WIRE-GND-10SQMM']||0)*qualityMultiplier;
                    tMat += gP*qty;
                    if(!res.purchaseOrder[mid]) res.purchaseOrder[mid] = {description: `สายเมน ${mainType} ${size}`, unit:'m', quantity:0, unit_price:p};
                    res.purchaseOrder[mid].quantity += q;
                }
            } else {
                const p = (priceList[m.material_id]||0)*qualityMultiplier;
                tMat += p*qty;
                if(!res.purchaseOrder[m.material_id]) res.purchaseOrder[m.material_id] = {description: allItems.get(m.material_id)?.desc||m.material_id, unit:'unit', quantity:0, unit_price:p};
                res.purchaseOrder[m.material_id].quantity += qty;
            }
        });
        
        t.labor_components?.forEach(l => tLab += (priceList[l.labor_id]||0)*qty);
        totalMat += tMat; totalLab += tLab;
        
        res.combined.push({description:t.task_name, quantity:qty, unit:t.unit_of_measure, material_unit_cost: qty?tMat/qty:0, labor_unit_cost: qty?tLab/qty:0});
        res.labor.push({description:t.task_name, quantity:qty, unit:t.unit_of_measure, unit_price: qty?tLab/qty:0, total_price: tLab});
        res.material.push({description:t.task_name, quantity:qty, unit:t.unit_of_measure, unit_price: qty?tMat/qty:0, total_price: tMat});
    }

    manualBOQ.forEach(i => { totalMat += i.material_unit_cost*i.quantity; totalLab += i.labor_unit_cost*i.quantity; res.combined.push(i); });
    
    const pMult = (province==='กรุงเทพมหานคร') ? (bkkZoneMultipliers[bkkZone]||bkkZoneMultipliers['BKK_Zone5_Suburban']) : (provinceMultipliers[province]||provinceMultipliers.default);
    totalLab *= pMult.labor; totalMat *= pMult.material;

    res.totalMaterialCost = totalMat * (1+wastageFactor);
    res.totalLaborCost = totalLab;
    const sub = res.totalMaterialCost + res.totalLaborCost;
    res.overheadAmount = sub * overheadFactor;
    res.profitAmount = (sub + res.overheadAmount) * profitFactor;
    res.grandTotal = Math.max(minCharge, sub + res.overheadAmount + res.profitAmount);
    res.vatAmount = includeVat ? res.grandTotal * 0.07 : 0;
    res.totalWithVat = res.grandTotal + res.vatAmount;

    return res;
}
