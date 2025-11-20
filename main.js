// main.js
// เวอร์ชันสมบูรณ์: แก้ไขสูตร % และเพิ่มฟังก์ชัน Export PDF/Image

import { provinces } from './data/provinces.js';
import { calculateProjectCost, getPriceList, setPrice, getAllItems } from './modules/calculator.js';
import { renderCircuitInputs, renderDedicatedCircuitInputs, formatCurrency } from './modules/ui_renderer.js';
import { generateReport } from './modules/report_generator.js';
import { renderProjectInfoCard, renderWorkDetails, renderSettingsCard, renderSummaryCard, renderJobCostingSection } from './modules/components.js';

// Global State
let manualBOQItems = [];
let manualPOItems = [];
let activeTab = 'boq-combined';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    console.log("App Starting...");

    // 1. สร้างหน้าจอ (UI)
    renderAppUI();

    // 2. โหลดข้อมูลจังหวัด
    const provinceSelector = document.getElementById('province_selector');
    if(provinceSelector) {
        provinceSelector.add(new Option('กรุงเทพมหานคร', 'กรุงเทพมหานคร'));
        provinces.forEach(p => provinceSelector.add(new Option(p, p)));
    }
    const dateEl = document.getElementById('report_date');
    if(dateEl) dateEl.valueAsDate = new Date();

    // 3. ผูกเหตุการณ์ต่างๆ (Events)
    setupCollapsibleCards();
    setupEventListeners();
    setupManualJobListeners();
    setupTabListeners();
    setupExportButtons(); // เพิ่มฟังก์ชันปุ่ม Export
    
    // 4. เตรียมข้อมูลราคาและคำนวณครั้งแรก
    populatePriceEditor();
    updateRealtimeTotal();
    
    console.log("App Initialized Successfully!");
}

function renderAppUI() {
    const ids = ['app-project-info', 'app-work-details', 'app-settings', 'app-summary', 'app-manual-job'];
    const renderers = [renderProjectInfoCard, renderWorkDetails, renderSettingsCard, renderSummaryCard, renderJobCostingSection];
    
    ids.forEach((id, index) => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = renderers[index]();
    });
}

function setupCollapsibleCards() {
    document.querySelectorAll('.collapsible-card h3').forEach(h => {
        h.addEventListener('click', () => { h.parentElement.classList.toggle('open'); });
    });
}

function setupEventListeners() {
    document.querySelectorAll('input, select').forEach(input => {
        if (input.id.includes('_circuit_') || input.id.includes('inter_dist') || input.id.includes('manual-job')) return; 
        
        input.addEventListener('change', () => {
            handleSpecificChanges(input);
            updateRealtimeTotal();
        });
        if(input.type === 'number' || input.type === 'text') {
            input.addEventListener('input', updateRealtimeTotal);
        }
    });

    // Dynamic Inputs Listeners
    const setupDynamicListener = (id, type, containerId) => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', (e) => {
            if(type === 'socket' || type === 'light') renderCircuitInputs(type, parseInt(e.target.value)||0, document.getElementById(containerId));
            else renderDedicatedCircuitInputs(type, parseInt(e.target.value)||0, document.getElementById(containerId));
            reattachDynamicListeners();
        });
    };

    setupDynamicListener('socket_circuits', 'socket', 'socket_circuits_container');
    setupDynamicListener('light_circuits', 'light', 'light_circuits_container');
    setupDynamicListener('ac_wiring_units', 'ac_wiring', 'ac_wiring_circuits_container');
    setupDynamicListener('heater_wiring_units', 'heater_wiring', 'heater_wiring_circuits_container');

    const calcBtn = document.getElementById('calculate-btn');
    if(calcBtn) calcBtn.addEventListener('click', () => displayReport());
}

function handleSpecificChanges(input) {
    if(input.id === 'province_selector') {
        const zoneContainer = document.getElementById('bkk_zone_container');
        if(zoneContainer) {
             if (input.value === 'กรุงเทพมหานคร') zoneContainer.classList.remove('hidden');
             else zoneContainer.classList.add('hidden');
        }
    }
    if(input.id === 'toggle_ev_charger_visibility') {
        const wrapper = document.getElementById('ev_charger_content_wrapper');
        if(wrapper) {
            if(input.checked) wrapper.classList.remove('hidden');
            else {
                wrapper.classList.add('hidden');
                document.getElementById('ev_cable_dist_8').value = 0;
                document.getElementById('ev_charger_cost_8').value = 0;
            }
        }
    }
}

function reattachDynamicListeners() {
    document.querySelectorAll('.circuit-container input, .circuit-container select').forEach(input => {
        input.addEventListener('input', updateRealtimeTotal);
        input.addEventListener('change', updateRealtimeTotal);
    });
}

// --- ฟังก์ชันคำนวณและส่งค่า (แก้ไขสูตร % ตรงนี้) ---
function performCalculation() {
    const quantities = buildQuantitiesFromDOM();
    
    const settings = {
        qualityMultiplier: parseFloat(document.getElementById('material_quality').value) || 1.0,
        // แก้ไข: หาร 100 เพื่อให้ 5 กลายเป็น 0.05 (5%) ไม่ใช่ 5 เท่า (500%)
        wastageFactor: (parseFloat(document.getElementById('wastage_factor').value) || 0) / 100,
        overheadFactor: (parseFloat(document.getElementById('overhead_factor').value) || 0) / 100,
        profitFactor: (parseFloat(document.getElementById('profit_factor').value) || 0) / 100,
        
        province: document.getElementById('province_selector').value,
        bkkZone: document.getElementById('bkk_zone_selector').value,
        includeVat: document.getElementById('include_vat').checked,
        minCharge: parseFloat(document.getElementById('min_charge').value) || 0,
        cableSpecConfig: {
            authority: document.getElementById('main_authority_7').value,
            meterSize: document.getElementById('meter_size_3').value,
            mainType: document.getElementById('main_ext_type_7').value
        }
    };

    return calculateProjectCost(quantities, settings, manualPOItems, manualBOQItems);
}

function updateRealtimeTotal() {
    const costs = performCalculation();
    document.getElementById('total-display').textContent = `฿${formatCurrency(costs.totalWithVat)}`;
}

// --- ระบบ Export PDF และ Image ---
function setupExportButtons() {
    const savePdfBtn = document.getElementById('save-pdf-btn');
    const saveImageBtn = document.getElementById('save-image-btn');

    if (savePdfBtn) {
        savePdfBtn.addEventListener('click', async () => {
            const btnOriginalText = savePdfBtn.innerText;
            savePdfBtn.innerText = "กำลังสร้าง...";
            savePdfBtn.disabled = true;
            
            try {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('p', 'mm', 'a4');
                const element = document.getElementById('output-section'); // จับเฉพาะส่วนรายงาน
                
                // ซ่อนปุ่มตอนแคป
                const buttons = element.querySelectorAll('button, .no-print');
                buttons.forEach(b => b.style.display = 'none');

                await doc.html(element, {
                    callback: function(doc) {
                        doc.save('ใบเสนอราคา.pdf');
                        // คืนค่าปุ่ม
                        buttons.forEach(b => b.style.display = '');
                        savePdfBtn.innerText = btnOriginalText;
                        savePdfBtn.disabled = false;
                    },
                    x: 10,
                    y: 10,
                    width: 190, // A4 width - margins
                    windowWidth: element.scrollWidth
                });
            } catch (error) {
                console.error("PDF Error:", error);
                alert("เกิดข้อผิดพลาดในการสร้าง PDF");
                savePdfBtn.innerText = btnOriginalText;
                savePdfBtn.disabled = false;
            }
        });
    }

    if (saveImageBtn) {
        saveImageBtn.addEventListener('click', () => {
            const element = document.getElementById('output-section');
            // ซ่อนปุ่มตอนแคป
            const buttons = element.querySelectorAll('button, .no-print');
            buttons.forEach(b => b.style.display = 'none');

            html2canvas(element).then(canvas => {
                const link = document.createElement('a');
                link.download = 'ใบเสนอราคา.png';
                link.href = canvas.toDataURL();
                link.click();
                
                // คืนค่าปุ่ม
                buttons.forEach(b => b.style.display = '');
            });
        });
    }
}

// --- Helper Functions ---
function setupManualJobListeners() {
    const addRowBtn = document.getElementById('manual-job-add-material-row');
    const tableBody = document.querySelector('#manual-job-materials-table tbody');
    const addJobBtn = document.getElementById('manual-job-add-btn');

    if(addRowBtn && tableBody) {
        addRowBtn.addEventListener('click', () => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="text" class="form-input w-full manual-mat-desc" placeholder="รายการ"></td>
                <td><input type="number" class="form-input w-full manual-mat-qty" placeholder="0" min="0"></td>
                <td><input type="text" class="form-input w-full manual-mat-unit" placeholder="หน่วย"></td>
                <td><input type="number" class="form-input w-full manual-mat-price" placeholder="0.00" min="0"></td>
                <td><button type="button" class="btn-delete-row text-red-500 font-bold" onclick="this.closest('tr').remove()">&times;</button></td>`;
            tableBody.appendChild(row);
        });
    }

    if(addJobBtn) {
        addJobBtn.addEventListener('click', () => {
            const jobName = document.getElementById('manual-job-name').value.trim();
            const jobLabor = parseFloat(document.getElementById('manual-job-labor-total').value) || 0;
            const jobQty = parseFloat(document.getElementById('manual-job-qty').value) || 1;
            const jobUnit = document.getElementById('manual-job-unit').value.trim() || 'งาน';
            
            if (!jobName) { alert("กรุณากรอกชื่องาน"); return; }

            let jobMatTotal = 0;
            let i = 0;
            tableBody.querySelectorAll('tr').forEach(row => {
                const desc = row.querySelector('.manual-mat-desc').value.trim();
                const qty = parseFloat(row.querySelector('.manual-mat-qty').value)||0;
                const unit = row.querySelector('.manual-mat-unit').value.trim()||'หน่วย';
                const price = parseFloat(row.querySelector('.manual-mat-price').value)||0;
                
                if(desc && qty>0 && price>0){
                    manualPOItems.push({ id: `manual_po_${Date.now()}_${i++}`, description: desc, spec: `(จากงาน: ${jobName})`, quantity: qty, unit: unit, unit_price: price });
                    jobMatTotal += (qty * price);
                }
            });

            manualBOQItems.push({
                id: `manual_job_${Date.now()}`, description: jobName, quantity: jobQty, unit: jobUnit,
                labor_unit_cost: (jobQty>0)? (jobLabor / jobQty) : jobLabor, material_unit_cost: (jobQty>0)? (jobMatTotal / jobQty) : jobMatTotal
            });

            document.getElementById('manual-job-name').value = '';
            document.getElementById('manual-job-labor-total').value = '';
            tableBody.innerHTML = '';
            updateRealtimeTotal();
            displayReport();
            alert("เพิ่มงานพิเศษเรียบร้อยแล้ว");
        });
    }
}

function setupTabListeners() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            tabButtons.forEach(btn => btn.classList.remove('tab-active'));
            e.currentTarget.classList.add('tab-active');
            activeTab = e.currentTarget.dataset.tab;
            displayReport();
        });
    });
}

function buildQuantitiesFromDOM() {
    const quantities = new Map();
    const addQty = (id, val) => quantities.set(id, (quantities.get(id) || 0) + val);
    const getVal = (id) => parseFloat(document.getElementById(id)?.value) || 0;
    const getInt = (id) => parseInt(document.getElementById(id)?.value) || 0;

    // 1. Electrical Mains
    const poleHeight = document.getElementById('pole_height_7')?.value;
    const poles = getInt('pole_count_7');
    if (poles > 0 && poleHeight !== '0') {
        if (poleHeight === '6.0') addQty('17.1', poles);
        else if (poleHeight === '7.0') addQty('17.1-B', poles);
        else if (poleHeight === '8.0') addQty('17.2', poles);
        else if (poleHeight === '9.0') addQty('17.3', poles);
    }
    addQty('17.4-2', getInt('rack_2_sets_7'));
    addQty('17.4-4', getInt('rack_4_sets_7'));
    if (getVal('main_ext_dist_7') > 0) addQty('17.5', getVal('main_ext_dist_7'));

    // 2. Consumer Unit
    const cuSize = document.getElementById('cu_replacement')?.value;
    if(cuSize !== 'none') {
        const cuMap = {'4_slot':'9.1', '6_slot':'9.2', '8_slot':'9.3', '10_slot':'9.4', '12_slot':'9.5'};
        if(cuMap[cuSize]) addQty(cuMap[cuSize], 1);
    }
    if(document.getElementById('install_ground')?.checked) addQty('6.1', 1);
    addQty('10.1', getInt('mcb_16a'));
    addQty('10.2', getInt('mcb_20a'));
    addQty('10.3', getInt('mcb_32a'));

    // 3. Sockets
    const socketCount = getInt('socket_circuits');
    const socketType = document.getElementById('socket_type')?.value;
    for(let i=1; i<=socketCount; i++) {
        const dist = getVal(`socket_circuit_${i}_panel_dist`);
        const points = getInt(`socket_circuit_${i}_points`);
        if(points <= 0) continue;
        let interDist = 0;
        const container = document.querySelector(`[data-circuit-id="socket-${i}"]`);
        if(container) container.querySelectorAll('[id*="_inter_dist_"]').forEach(inp => interDist += parseFloat(inp.value)||0);
        const totalDist = dist + interDist;

        if(socketType === 'surface_vaf') { addQty('1.3', totalDist); addQty('3.1', points); }
        else if(socketType.includes('_pvc')) {
            addQty('1.1', totalDist); addQty(socketType.includes('concealed') ? '2.3' : '2.1', totalDist);
            addQty(socketType.includes('concealed') ? '3.2' : '3.1', points);
            if(!socketType.includes('trunking')) addQty('13.1', points*2); else addQty('14.1', totalDist);
        } else if(socketType.includes('_emt')) { addQty('1.1', totalDist); addQty('2.2', totalDist); addQty('3.1', points); addQty('13.2', points*2); }
    }

    // 4. Lighting
    const lightCount = getInt('light_circuits');
    const lightType = document.getElementById('light_type')?.value;
    const fixture = document.getElementById('fixture_type_1')?.value;
    for(let i=1; i<=lightCount; i++) {
        const panelToSwitch = getVal(`light_circuit_${i}_dist_panel_to_switch`);
        const switchToLight = getVal(`light_circuit_${i}_dist_switch_to_light`);
        const points = getInt(`light_circuit_${i}_points`);
        if(points <= 0) continue;
        let interDist = 0;
        const container = document.querySelector(`[data-circuit-id="light-${i}"]`);
        if(container) container.querySelectorAll('[id*="_inter_dist_"]').forEach(inp => interDist += parseFloat(inp.value)||0);
        const totalDist = panelToSwitch + switchToLight + interDist;

        addQty('1.2', totalDist);
        if(lightType.includes('_pvc')) addQty(lightType.includes('concealed') ? '2.3' : '2.1', totalDist);
        else if(lightType.includes('_emt')) addQty('2.2', totalDist); else if(lightType.includes('trunking')) addQty('14.1', totalDist);
        
        if(fixture === 'LED_E27') addQty('4.1', points); else if(fixture === 'LED_PANEL') addQty('15.1', points); else if(fixture === 'T8_SET') addQty('15.2', points);
    }

    // 5. AC/Heater
    ['ac_wiring', 'heater_wiring'].forEach(prefix => {
        const count = getInt(`${prefix}_units`);
        const installType = document.getElementById(prefix==='ac_wiring'?'ac_install_type_4':'wh_install_type_5')?.value;
        for(let i=1; i<=count; i++) {
            const p2b = getVal(`${prefix}_${i}_panel_to_breaker_dist`);
            const b2u = getVal(`${prefix}_${i}_breaker_to_unit_dist`);
            const ground = getVal(`${prefix}_${i}_panel_to_unit_dist_ground`);
            const totalDist = p2b + b2u;
            const breakerAmps = parseInt(document.getElementById(`${prefix}_${i}_breaker`)?.dataset.breakerAmps)||0;
            if(breakerAmps===0) continue;
            addQty('1.4', totalDist); addQty('1.5', ground); addQty('12.1', 1);
            if(installType.includes('_pvc')) addQty(installType.includes('concealed') ? '2.3' : '2.1', totalDist); else if(installType.includes('_emt')) addQty('2.2', totalDist);
            if(breakerAmps <= 16) addQty('10.1', 1); else if(breakerAmps <= 20) addQty('10.2', 1); else if(breakerAmps <= 32) addQty('10.3', 1);
        }
    });

    // 6-10. Others
    addQty('11.1', getInt('lan_points')); addQty('11.2', getVal('lan_distance'));
    addQty('11.3', getInt('tv_points')); addQty('11.4', getVal('tv_distance'));
    addQty('11.5', getInt('cctv_points'));
    addQty('7.1', getInt('heater_units')); addQty('5.1', getInt('ac_units'));
    addQty('5.3', getInt('pump_units')); const pumpType = document.getElementById('wp_install_type_6')?.value;
    if(pumpType === 'vct_clip') addQty('16.1', 15 * getInt('pump_units')); else if(pumpType === 'nyy_burial') { addQty('16.2', 15 * getInt('pump_units')); addQty('2.1', 15 * getInt('pump_units')); }
    addQty('5.4', getInt('fan_units'));
    if(document.getElementById('service_inspection')?.checked) addQty('8.1', 1);
    if(document.getElementById('service_leak_find')?.checked) addQty('8.2', 1);
    if(document.getElementById('service_trip_find')?.checked) addQty('8.3', 1);
    addQty('8.4', getInt('service_lamp_replace'));
    if(document.getElementById('toggle_ev_charger_visibility')?.checked && getVal('ev_cable_dist_8') > 0) {
        addQty('18.1', 1); if(document.getElementById('ev_install_type_8').value === 'new_meter_tou') addQty('18.2', 1);
        const evCost = getVal('ev_charger_cost_8'); if(evCost > 0) setPrice('M-EV-CHARGER-7KW', evCost);
    }
    addQty('19.1', getInt('demo_lights_9')); addQty('19.2', getInt('demo_outlets_9'));
    addQty('19.3', getInt('demo_cables_9')); addQty('19.4', getInt('demo_ac_9'));
    if(document.getElementById('demo_include_repair_9')?.checked) addQty('19.5', getInt('demo_lights_9') + getInt('demo_outlets_9'));

    return quantities;
}

function displayReport() {
    const costs = performCalculation();
    const output = document.getElementById('output-section');
    output.classList.remove('hidden');
    output.scrollIntoView({behavior:'smooth'});
    document.getElementById('report-content').innerHTML = generateReport(costs, activeTab).html;
}

function populatePriceEditor() {
    const container = document.getElementById('price-editor-body');
    const allItems = getAllItems();
    const currentPrices = getPriceList();
    let html = '';
    const hiddenTasks = ['17.4-2', '17.4-4', '5.2', '7.2'];
    for (const [id, data] of allItems) {
        if (hiddenTasks.includes(id)) continue;
        html += `<tr class="border-b"><td class="p-2"><div class="font-medium">${id}</div><div class="text-xs text-gray-500">${data.desc}</div></td><td class="p-2"><input type="number" data-price-id="${id}" value="${currentPrices[id]||0}" class="form-input w-24 p-1"></td></tr>`;
    }
    container.innerHTML = html;
    container.addEventListener('change', (e) => { if(e.target.dataset.priceId) { setPrice(e.target.dataset.priceId, parseFloat(e.target.value)); updateRealtimeTotal(); } });
}
