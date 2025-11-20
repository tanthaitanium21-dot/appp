// main.js
// เวอร์ชันสมบูรณ์ (Fixed: renderAppUI Missing)

import { provinces } from './data/provinces.js';
import { calculateProjectCost, getPriceList, setPrice, getAllItems } from './modules/calculator.js';
import { renderCircuitInputs, renderDedicatedCircuitInputs, renderDynamicInputs, formatCurrency } from './modules/ui_renderer.js';
import { generateReport } from './modules/report_generator.js';
import { renderProjectInfoCard, renderWorkDetails, renderSettingsCard, renderSummaryCard, renderJobCostingSection } from './modules/components.js';

// Global State
let manualBOQItems = [];
let manualPOItems = [];
let activeTab = 'boq-combined';

// --- 1. เริ่มต้นทำงาน (Init) ---
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    console.log("App Starting...");
    
    // สร้างหน้าจอ (Render UI)
    renderAppUI();

    // ตั้งค่าข้อมูลพื้นฐาน
    setupStaticData();

    // เริ่มการทำงานของระบบ
    setupEventListeners();
    setupCollapsibleCards();
    setupManualJobListeners();
    setupTabListeners();
    setupExportButtons();
    
    // คำนวณค่าเริ่มต้น
    populatePriceEditor();
    updateRealtimeTotal();
    
    console.log("App Initialized Successfully!");
}

// --- 2. ฟังก์ชันสร้างหน้าจอ (ต้องมีตัวนี้ Error ถึงจะหาย) ---
function renderAppUI() {
    const ids = ['app-project-info', 'app-work-details', 'app-settings', 'app-summary', 'app-manual-job'];
    const renderers = [renderProjectInfoCard, renderWorkDetails, renderSettingsCard, renderSummaryCard, renderJobCostingSection];
    
    ids.forEach((id, index) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = renderers[index]();
    });
}

// --- 3. ฟังก์ชันจัดการข้อมูลพื้นฐาน ---
function setupStaticData() {
    const provinceSelector = document.getElementById('province_selector');
    if (provinceSelector) {
        provinceSelector.add(new Option('กรุงเทพมหานคร', 'กรุงเทพมหานคร'));
        provinces.forEach(p => provinceSelector.add(new Option(p, p)));
    }
    const dateEl = document.getElementById('report_date');
    if (dateEl) dateEl.valueAsDate = new Date();
}

// --- 4. ฟังก์ชันจัดการ Event (การคลิก/พิมพ์) ---
function setupEventListeners() {
    // ดักจับการเปลี่ยนแปลงข้อมูลทั้งหมด
    document.body.addEventListener('change', (e) => {
        if (e.target.matches('input, select')) updateRealtimeTotal();
        handleSpecificChanges(e.target);
    });
    document.body.addEventListener('input', (e) => {
        if (e.target.matches('input[type="number"], input[type="text"]')) updateRealtimeTotal();
        
        // กรณีมีการกรอกจำนวนจุด -> ให้สร้างช่องกรอกระยะห่าง
        if (e.target.classList.contains('point-count-input')) {
            const prefix = e.target.dataset.prefix;
            const index = e.target.dataset.index;
            const points = parseInt(e.target.value) || 0;
            renderDynamicInputs(prefix, index, points);
            updateRealtimeTotal();
        }
    });
    
    // ตั้งค่า Listener เริ่มต้นสำหรับวงจรไฟฟ้า
    setupDynamicListener('socket_circuits', 'socket', 'socket_circuits_container');
    setupDynamicListener('light_circuits', 'light', 'light_circuits_container');
    setupDynamicListener('ac_wiring_units', 'ac_wiring', 'ac_wiring_circuits_container');
    setupDynamicListener('heater_wiring_units', 'heater_wiring', 'heater_wiring_circuits_container');

    // ปุ่มคำนวณ
    const calcBtn = document.getElementById('calculate-btn');
    if (calcBtn) calcBtn.addEventListener('click', displayReport);
}

function setupDynamicListener(id, type, containerId) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', (e) => {
        if (type === 'socket' || type === 'light') {
            renderCircuitInputs(type, parseInt(e.target.value) || 0, document.getElementById(containerId));
        } else {
            renderDedicatedCircuitInputs(type, parseInt(e.target.value) || 0, document.getElementById(containerId));
        }
    });
}

function handleSpecificChanges(input) {
    if (input.id === 'province_selector') {
        const zoneContainer = document.getElementById('bkk_zone_container');
        if (zoneContainer) {
            if (input.value === 'กรุงเทพมหานคร') zoneContainer.classList.remove('hidden');
            else zoneContainer.classList.add('hidden');
        }
    }
    if (input.id === 'toggle_ev_charger_visibility') {
        const wrapper = document.getElementById('ev_charger_content_wrapper');
        if (wrapper) {
            if (input.checked) wrapper.classList.remove('hidden');
            else {
                wrapper.classList.add('hidden');
                document.getElementById('ev_cable_dist_8').value = 0;
                document.getElementById('ev_charger_cost_8').value = 0;
            }
        }
    }
}

// --- 5. Logic การคำนวณ ---
function buildQuantitiesFromDOM() {
    const quantities = new Map();
    const addQty = (id, val) => quantities.set(id, (quantities.get(id) || 0) + val);
    const getVal = (id) => parseFloat(document.getElementById(id)?.value) || 0;
    const getInt = (id) => parseInt(document.getElementById(id)?.value) || 0;

    // 1. เมนไฟฟ้า
    const ph = document.getElementById('pole_height_7')?.value;
    const pc = getInt('pole_count_7');
    if (pc > 0 && ph !== '0') {
        if (ph === '6.0') addQty('17.1', pc); 
        else if (ph === '7.0') addQty('17.1-B', pc);
        else if (ph === '8.0') addQty('17.2', pc); 
        else if (ph === '9.0') addQty('17.3', pc);
    }
    addQty('17.4-2', getInt('rack_2_sets_7'));
    addQty('17.4-1', getInt('rack_1_set_7'));
    
    if (getVal('main_ext_dist_7') > 0) addQty('17.5', getVal('main_ext_dist_7'));

    // 2. ตู้ไฟ
    const cu = document.getElementById('cu_replacement')?.value;
    if (cu !== 'none') {
        const map = {'4_slot':'9.1', '6_slot':'9.2', '8_slot':'9.3', '10_slot':'9.4', '12_slot':'9.5'};
        if (map[cu]) addQty(map[cu], 1);
    }
    if (document.getElementById('install_ground')?.checked) addQty('6.1', 1);
    addQty('10.1', getInt('mcb_16a')); 
    addQty('10.2', getInt('mcb_20a')); 
    addQty('10.3', getInt('mcb_32a'));

    // 3. เต้ารับ (รวมระยะห่างเพิ่ม)
    const sc = getInt('socket_circuits');
    const st = document.getElementById('socket_type')?.value;
    for (let i = 1; i <= sc; i++) {
        let dist = getVal(`socket_circuit_${i}_panel_dist`);
        // บวกระยะเพิ่ม (ซม. เป็น เมตร)
        document.querySelectorAll(`input.extra-dist-input[data-circuit="socket-${i}"]`).forEach(inp => {
            dist += (parseFloat(inp.value) || 0) / 100;
        });

        const pts = getInt(`socket_circuit_${i}_points`);
        if (pts > 0) {
            if (st === 'surface_vaf') { addQty('1.3', dist); addQty('3.1', pts); }
            else if (st.includes('_pvc')) { 
                addQty('1.1', dist); 
                addQty(st.includes('concealed') ? '2.3' : '2.1', dist); 
                addQty(st.includes('concealed') ? '3.2' : '3.1', pts); 
                if (st.includes('trunking')) addQty('14.1', dist); 
            } else if (st.includes('_emt')) { 
                addQty('1.1', dist); addQty('2.2', dist); addQty('3.1', pts); 
            }
        }
    }

    // 4. แสงสว่าง (รวมระยะห่างเพิ่ม)
    const lc = getInt('light_circuits');
    const lt = document.getElementById('light_type')?.value;
    const ft = document.getElementById('fixture_type_1')?.value;
    for (let i = 1; i <= lc; i++) {
        let dist = getVal(`light_circuit_${i}_dist_panel_to_switch`) + getVal(`light_circuit_${i}_dist_switch_to_light`);
        // บวกระยะเพิ่ม (เมตร)
        document.querySelectorAll(`input.extra-dist-input[data-circuit="light-${i}"]`).forEach(inp => {
            dist += (parseFloat(inp.value) || 0);
        });

        const pts = getInt(`light_circuit_${i}_points`);
        if (pts > 0) {
            addQty('1.2', dist);
            if (lt.includes('_pvc')) addQty(lt.includes('concealed') ? '2.3' : '2.1', dist);
            else if (lt.includes('_emt')) addQty('2.2', dist); 
            else if (lt.includes('trunking')) addQty('14.1', dist);
            
            if (ft === 'LED_E27') addQty('4.1', pts); 
            else if (ft === 'LED_PANEL') addQty('15.1', pts); 
            else if (ft === 'T8_SET') addQty('15.2', pts);
        }
    }

    // 5. แอร์/น้ำอุ่น
    ['ac_wiring', 'heater_wiring'].forEach(p => {
        const c = getInt(`${p}_units`);
        const it = document.getElementById(p === 'ac_wiring' ? 'ac_install_type_4' : 'wh_install_type_5')?.value;
        for (let i = 1; i <= c; i++) {
            const d = getVal(`${p}_${i}_dist`);
            if (d > 0) { 
                addQty('1.4', d); addQty('1.5', d); 
                if (it.includes('_pvc')) addQty(it.includes('concealed') ? '2.3' : '2.1', d); 
                else if (it.includes('_emt')) addQty('2.2', d); 
            }
        }
    });

    // 6-10. หมวดอื่นๆ
    addQty('11.1', getInt('lan_points')); addQty('11.2', getVal('lan_distance'));
    addQty('11.3', getInt('tv_points')); addQty('11.4', getVal('tv_distance'));
    addQty('11.5', getInt('cctv_points'));
    addQty('7.1', getInt('heater_units')); addQty('5.1', getInt('ac_units'));
    addQty('5.3', getInt('pump_units')); 
    const pt = document.getElementById('wp_install_type_6')?.value;
    if (pt === 'vct_clip') addQty('16.1', 15 * getInt('pump_units')); 
    else if (pt === 'nyy_burial') { addQty('16.2', 15 * getInt('pump_units')); addQty('2.1', 15 * getInt('pump_units')); }
    addQty('5.4', getInt('fan_units'));
    
    if (document.getElementById('service_inspection')?.checked) addQty('8.1', 1);
    if (document.getElementById('service_leak_find')?.checked) addQty('8.2', 1);
    if (document.getElementById('service_trip_find')?.checked) addQty('8.3', 1);
    addQty('8.4', getInt('service_lamp_replace'));
    
    if (document.getElementById('toggle_ev_charger_visibility')?.checked && getVal('ev_cable_dist_8') > 0) {
        addQty('18.1', 1); 
        if (document.getElementById('ev_install_type_8').value === 'new_meter_tou') addQty('18.2', 1);
        const evCost = getVal('ev_charger_cost_8'); 
        if (evCost > 0) setPrice('M-EV-CHARGER-7KW', evCost);
    }
    
    addQty('19.1', getInt('demo_lights_9')); 
    addQty('19.2', getInt('demo_outlets_9'));
    addQty('19.3', getInt('demo_cables_9')); 
    addQty('19.4', getInt('demo_ac_9'));
    if (document.getElementById('demo_include_repair_9')?.checked) addQty('19.5', getInt('demo_lights_9') + getInt('demo_outlets_9'));

    return quantities;
}

function performCalculation() {
    const settings = {
        qualityMultiplier: parseFloat(document.getElementById('material_quality').value) || 1.0,
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
            mainType: document.getElementById('main_ext_type_7').value,
            manualSize: document.getElementById('main_cable_size_7').value
        }
    };

    return calculateProjectCost(buildQuantitiesFromDOM(), settings, manualPOItems, manualBOQItems);
}

function updateRealtimeTotal() {
    const costs = performCalculation();
    document.getElementById('total-display').textContent = `฿${formatCurrency(costs.totalWithVat)}`;
}

function displayReport() {
    const costs = performCalculation();
    const output = document.getElementById('output-section');
    output.classList.remove('hidden');
    output.scrollIntoView({behavior:'smooth'});
    document.getElementById('report-content').innerHTML = generateReport(costs, activeTab).html;
}

// --- 6. ฟังก์ชันเสริม (Export/Helpers) ---
function setupExportButtons() {
    const savePdfBtn = document.getElementById('save-pdf-btn');
    const saveImageBtn = document.getElementById('save-image-btn');

    if (savePdfBtn) {
        savePdfBtn.addEventListener('click', async () => {
            const btnOriginalText = savePdfBtn.innerText;
            savePdfBtn.innerText = "Processing...";
            savePdfBtn.disabled = true;
            try {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('p', 'mm', 'a4');
                const element = document.getElementById('output-section');
                
                const buttons = element.querySelectorAll('button, .no-print');
                buttons.forEach(b => b.style.display = 'none');

                await doc.html(element, {
                    callback: function(doc) {
                        doc.save('quotation.pdf');
                        buttons.forEach(b => b.style.display = '');
                        savePdfBtn.innerText = btnOriginalText;
                        savePdfBtn.disabled = false;
                    },
                    x: 10, y: 10, width: 190, windowWidth: element.scrollWidth
                });
            } catch (error) {
                console.error(error);
                savePdfBtn.innerText = btnOriginalText;
                savePdfBtn.disabled = false;
            }
        });
    }

    if (saveImageBtn) {
        saveImageBtn.addEventListener('click', () => {
            const element = document.getElementById('output-section');
            const buttons = element.querySelectorAll('button, .no-print');
            buttons.forEach(b => b.style.display = 'none');

            html2canvas(element).then(canvas => {
                const link = document.createElement('a');
                link.download = 'quotation.png';
                link.href = canvas.toDataURL();
                link.click();
                buttons.forEach(b => b.style.display = '');
            });
        });
    }
}

function setupCollapsibleCards() {
    document.querySelectorAll('.collapsible-card h3').forEach(h => {
        h.addEventListener('click', () => { h.parentElement.classList.toggle('open'); });
    });
}

function setupManualJobListeners() {
    const addRowBtn = document.getElementById('manual-job-add-material-row');
    const tableBody = document.querySelector('#manual-job-materials-table tbody');
    const addJobBtn = document.getElementById('manual-job-add-btn');

    if (addRowBtn && tableBody) {
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

    if (addJobBtn) {
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
                const qty = parseFloat(row.querySelector('.manual-mat-qty').value) || 0;
                const unit = row.querySelector('.manual-mat-unit').value.trim() || 'หน่วย';
                const price = parseFloat(row.querySelector('.manual-mat-price').value) || 0;
                
                if (desc && qty > 0 && price > 0) {
                    manualPOItems.push({
                        id: `manual_po_${Date.now()}_${i++}`,
                        description: desc,
                        spec: `(จากงาน: ${jobName})`,
                        quantity: qty,
                        unit: unit,
                        unit_price: price
                    });
                    jobMatTotal += (qty * price);
                }
            });

            manualBOQItems.push({
                id: `manual_job_${Date.now()}`,
                description: jobName,
                quantity: jobQty,
                unit: jobUnit,
                labor_unit_cost: (jobQty > 0) ? (jobLabor / jobQty) : jobLabor,
                material_unit_cost: (jobQty > 0) ? (jobMatTotal / jobQty) : jobMatTotal
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

function populatePriceEditor() {
    const container = document.getElementById('price-editor-body');
    const allItems = getAllItems();
    const currentPrices = getPriceList();
    
    let html = '';
    const hiddenTasks = ['17.4-2', '17.4-4', '5.2', '7.2'];
    for (const [id, data] of allItems) {
        if (hiddenTasks.includes(id)) continue;
        html += `<tr class="border-b"><td class="p-2"><div class="font-medium">${id}</div><div class="text-xs text-gray-500">${data.desc}</div></td>
                 <td class="p-2"><input type="number" data-price-id="${id}" value="${currentPrices[id]||0}" class="form-input w-24 p-1"></td></tr>`;
    }
    container.innerHTML = html;
    
    container.addEventListener('change', (e) => {
        if (e.target.dataset.priceId) {
            setPrice(e.target.dataset.priceId, parseFloat(e.target.value));
            updateRealtimeTotal();
        }
    });
}
