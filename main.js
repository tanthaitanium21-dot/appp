// main.js
// เวอร์ชัน V2 Fixed (Final): กู้คืน Logic การคำนวณ V1 ครบถ้วน + แก้ไขบั๊กไฟล์ไม่จบ

import { provinces, provinceZones } from './data/provinces.js';
import { mainCableSpecs } from './data/electrical_data.js';
import { calculateProjectCost, setPrice, getPriceList } from './modules/calculator.js';
import { renderCircuitInputs, renderDedicatedCircuitInputs, renderDynamicInputs, formatCurrency } from './modules/ui_renderer.js';
import { generateReport } from './modules/report_generator.js';
import { renderProjectInfoCard, renderWorkDetails, renderSettingsCard, renderSummaryCard, renderJobCostingSection } from './modules/components.js';

// Global State
let manualBOQItems = [];
let manualPOItems = [];
let activeTab = 'boq-combined';

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    console.log("App Starting (V2 Fixed Final)...");
    
    // 1. Render UI Structure
    renderAppUI();
    
    // 2. Setup Data & Listeners
    setupStaticData();
    setupEventListeners();
    populatePriceEditor();
    
    // 3. Initial Calculation
    handleProvinceChange(); // Set default authority/zone
    updateMainCableSpecDisplay();
    updateRealtimeTotal();
}

function renderAppUI() {
    const map = {
        'app-project-info': renderProjectInfoCard,
        'app-work-details': renderWorkDetails,
        'app-settings': renderSettingsCard,
        'app-summary': renderSummaryCard,
        'app-manual-job': renderJobCostingSection
    };
    for (const [id, func] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = func();
    }
}

function setupStaticData() {
    const ps = document.getElementById('province_selector');
    if(ps) { 
        // Reset options first
        ps.innerHTML = '';
        ps.add(new Option('กรุงเทพมหานคร', 'กรุงเทพมหานคร')); 
        provinces.forEach(p => ps.add(new Option(p, p))); 
        ps.value = 'นนทบุรี'; // Default Province
    }
    const rd = document.getElementById('report_date');
    if(rd) rd.valueAsDate = new Date();
}

function setupEventListeners() {
    // Global Change Listener (สำหรับ Input ทั่วไป)
    document.body.addEventListener('change', (e) => {
        // Logic เฉพาะจุด
        if(e.target.id === 'province_selector') handleProvinceChange();
        if(['main_authority_7', 'meter_size_3', 'main_ext_type_7'].includes(e.target.id)) updateMainCableSpecDisplay();
        if(e.target.id === 'toggle_ev_charger_visibility') handleEVToggle(e.target);
        if(e.target.classList.contains('dedicated-unit-size')) updateBreakerLabel(e.target);
        
        // คำนวณใหม่ทุกครั้งที่มีการเปลี่ยนค่า
        if(e.target.matches('input, select')) updateRealtimeTotal();
    });

    // Global Input Listener (สำหรับพิมพ์ตัวเลข)
    document.body.addEventListener('input', (e) => {
        if(e.target.matches('input[type="number"], input[type="text"]')) updateRealtimeTotal();
        
        // Dynamic Point Inputs (ช่องกรอกระยะย่อย)
        if(e.target.classList.contains('point-count-input')) {
            renderDynamicInputs(e.target.dataset.prefix, e.target.dataset.index, parseInt(e.target.value)||0);
            updateRealtimeTotal();
        }
    });
    
    // Dynamic Circuit Setup (สร้างช่องกรอกวงจร)
    setupDynamicListener('socket_circuits', 'socket', 'socket_circuits_container');
    setupDynamicListener('light_circuits', 'light', 'light_circuits_container');
    setupDynamicListener('ac_wiring_units', 'ac_wiring', 'ac_wiring_circuits_container');
    setupDynamicListener('heater_wiring_units', 'heater_wiring', 'heater_wiring_circuits_container');

    // Buttons
    const calcBtn = document.getElementById('calculate-btn');
    if(calcBtn) calcBtn.addEventListener('click', displayReport);
    
    setupExportButtons();
    setupManualJobListeners();
    setupTabListeners();
}

// --- Logic: จัดการจังหวัดและโซน ---
function handleProvinceChange() {
    const province = document.getElementById('province_selector').value;
    const bkkZoneContainer = document.getElementById('bkk_zone_container');
    const authEl = document.getElementById('main_authority_7');

    // Toggle BKK Zone selector
    if(bkkZoneContainer) {
        if(province === 'กรุงเทพมหานคร') {
            bkkZoneContainer.classList.remove('hidden');
        } else {
            bkkZoneContainer.classList.add('hidden');
        }
    }

    // Auto-select Authority (กฟน./กฟภ.)
    if(authEl) {
        const isMEA = provinceZones.MEA.includes(province);
        authEl.value = isMEA ? 'MEA' : 'PEA';
    }
    updateMainCableSpecDisplay();
}

// --- Logic: แนะนำขนาดสายเมน (Standard V1) ---
function updateMainCableSpecDisplay() {
    const authority = document.getElementById('main_authority_7')?.value;
    const meterSize = document.getElementById('meter_size_3')?.value;
    const cableType = document.getElementById('main_ext_type_7')?.value;
    const displayEl = document.getElementById('main_cable_spec_display');
    
    if(!authority || !meterSize || !cableType || !displayEl) return;

    // บังคับ Logic กฟน. ห้ามใช้ THW-A
    const thwAOption = document.getElementById('main_ext_type_7').querySelector('option[value="THW-A"]');
    if(authority === 'MEA') {
        if(thwAOption) thwAOption.disabled = true;
        if(cableType === 'THW-A') {
            document.getElementById('main_ext_type_7').value = 'THW';
            return updateMainCableSpecDisplay(); // เรียกซ้ำเพื่ออัปเดต
        }
    } else {
        if(thwAOption) thwAOption.disabled = false;
    }

    let cableSpecText = "N/A";
    try {
        const size = mainCableSpecs[authority][meterSize][cableType];
        if (size) {
            cableSpecText = `${cableType} ${size} sq.mm.`;
            displayEl.className = "mt-1 p-3 bg-green-100 text-green-800 rounded-md font-mono text-lg text-center border border-green-200";
            // เก็บค่าไว้ใช้ตอนคำนวณ (ถ้าผู้ใช้เลือก Auto)
            displayEl.dataset.autoSize = size;
        } else {
            cableSpecText = "ไม่อนุญาต / ไม่พบข้อมูล";
            displayEl.className = "mt-1 p-3 bg-red-100 text-red-800 rounded-md font-mono text-lg text-center border border-red-200";
            displayEl.dataset.autoSize = 0;
        }
    } catch (e) {
        cableSpecText = "Error Checking Spec";
    }

    displayEl.textContent = cableSpecText;
}

// --- Logic: แนะนำเบรกเกอร์ (Auto Breaker) ---
function updateBreakerLabel(selectElement) {
    const displayId = selectElement.dataset.displayId;
    const type = selectElement.dataset.type;
    const val = parseInt(selectElement.value);
    const displayEl = document.getElementById(displayId);
    
    let amps = 0;
    let text = 'N/A';
    
    if (type === 'ac') {
        // Logic แอร์
        if (val <= 12000) { amps = 20; text = '20A'; }
        else if (val <= 18000) { amps = 20; text = '20A'; }
        else if (val <= 24000) { amps = 32; text = '32A'; }
        else { amps = 32; text = '32A'; }
    } else {
        // Logic น้ำอุ่น
        if (val <= 3500) { amps = 20; text = '20A'; }
        else if (val <= 4500) { amps = 20; text = '20A'; }
        else { amps = 32; text = '32A'; }
    }
    
    if(displayEl) {
        displayEl.textContent = `Breaker: ${text}`;
        displayEl.className = `text-xs font-mono px-2 py-1 rounded ${amps > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`;
        displayEl.dataset.amps = amps;
    }
}

function setupDynamicListener(id, type, containerId) {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', (e) => {
        const count = parseInt(e.target.value)||0;
        if(type === 'socket' || type === 'light') {
            renderCircuitInputs(type, count, document.getElementById(containerId));
        } else {
            renderDedicatedCircuitInputs(type, count, document.getElementById(containerId));
            setTimeout(() => {
                // Update labels for newly created inputs
                document.querySelectorAll(`#${containerId} .dedicated-unit-size`).forEach(sel => updateBreakerLabel(sel));
            }, 0);
        }
    });
}

function handleEVToggle(checkbox) {
    const wrapper = document.getElementById('ev_charger_content_wrapper');
    if(wrapper) wrapper.classList.toggle('hidden', !checkbox.checked);
    if(!checkbox.checked) {
        document.getElementById('ev_cable_dist_8').value = 20;
        document.getElementById('ev_charger_cost_8').value = 35000;
    }
    updateRealtimeTotal();
}

// --- Core: รวบรวมปริมาณงานจากหน้าจอ (Logic V1 Restoration) ---
function buildQuantitiesFromDOM() {
    const quantities = new Map();
    const addQty = (id, val) => { 
        if(!val || val <= 0 || isNaN(val)) return;
        quantities.set(id, (quantities.get(id) || 0) + val);
    };
    const getVal = (id) => parseFloat(document.getElementById(id)?.value) || 0;
    const getInt = (id) => parseInt(document.getElementById(id)?.value) || 0;

    // 1. เสาไฟและเมนภายนอก
    const ph = document.getElementById('pole_height_7')?.value;
    const pc = getInt('pole_count_7');
    if (pc > 0 && ph !== '0') {
        if (ph === '6.0') addQty('17.1', pc); 
        else if (ph === '7.0') addQty('17.1-B', pc);
        else if (ph === '8.0') addQty('17.2', pc); 
        else if (ph === '9.0') addQty('17.3', pc);
    }
    addQty('17.4-2', getInt('rack_2_sets_7'));
    addQty('17.4-1', getInt('rack_1_set_7')); // Rack 1 set
    
    const mainDist = getVal('main_ext_dist_7');
    if (mainDist > 0) addQty('17.5', mainDist); // คำนวณสายเมน (รายละเอียดใน calculator.js)

    // 2. Consumer Unit & Grounding
    const cu = document.getElementById('cu_replacement')?.value;
    if(cu !== 'none') {
        const map = {'4_slot':'9.1', '6_slot':'9.2', '8_slot':'9.3', '10_slot':'9.4', '12_slot':'9.5'};
        if(map[cu]) addQty(map[cu], 1);
    }
    if(document.getElementById('install_ground')?.checked) {
        addQty('6.1', 1); // ชุดหลักดิน
        addQty('1.5', getVal('ground_distance')); // สายดินเข้าตู้ (ใช้ Task 1.5 หรือสร้างใหม่)
    }
    addQty('10.1', getInt('mcb_16a')); 
    addQty('10.2', getInt('mcb_20a')); 
    addQty('10.3', getInt('mcb_32a'));

    // 3. Sockets (Logic V1: Fitting Calculation)
    const sc = getInt('socket_circuits');
    const st = document.getElementById('socket_type')?.value;
    for(let i=1; i<=sc; i++) {
        let dist = getVal(`socket_circuit_${i}_panel_dist`);
        // รวมระยะย่อย (ซม. -> ม.)
        document.querySelectorAll(`input.extra-dist-input[data-circuit="socket-${i}"]`).forEach(inp => {
            dist += (parseFloat(inp.value)||0)/100; 
        });
        const pts = getInt(`socket_circuit_${i}_points`);
        if(pts > 0) {
            if(st==='surface_vaf') { 
                addQty('1.3', dist); // สาย VAF
                addQty('3.1', pts); // เต้ารับลอย
            } else {
                addQty('1.1', dist); // สาย THW 2.5 (L,N,G คิดใน Data)
                
                if(st.includes('_pvc')) {
                    addQty(st.includes('concealed')?'2.3':'2.1', dist); // ท่อ
                    addQty(st.includes('concealed')?'3.2':'3.1', pts); // เต้ารับ
                    if(!st.includes('trunking')) addQty('13.1', pts * 2); // Fitting PVC (เฉลี่ย 2 ตัว/จุด)
                } else if(st.includes('_emt')) {
                    addQty('2.2', dist);
                    addQty('3.1', pts);
                    addQty('13.2', pts * 2); // Fitting EMT
                }
                if(st.includes('trunking')) addQty('14.1', dist);
            }
        }
    }

    // 4. Lighting (Logic V1: Fitting Calculation)
    const lc = getInt('light_circuits');
    const lt = document.getElementById('light_type')?.value;
    const ft = document.getElementById('fixture_type_1')?.value;
    for(let i=1; i<=lc; i++) {
        // ระยะรวม = ตู้->สวิตช์ + สวิตช์->โคม + ระยะระหว่างโคม
        let dist = getVal(`light_circuit_${i}_dist_panel_to_switch`) + getVal(`light_circuit_${i}_dist_switch_to_light`);
        document.querySelectorAll(`input.extra-dist-input[data-circuit="light-${i}"]`).forEach(inp => dist += (parseFloat(inp.value)||0));
        
        const pts = getInt(`light_circuit_${i}_points`);
        if(pts > 0) {
            addQty('1.2', dist); // สาย THW 1.5
            
            if(lt.includes('_pvc')) {
                addQty(lt.includes('concealed')?'2.3':'2.1', dist);
                if(!lt.includes('trunking')) addQty('13.1', pts * 2);
            } else if(lt.includes('_emt')) {
                addQty('2.2', dist);
                addQty('13.2', pts * 2);
            } else if(lt.includes('trunking')) {
                addQty('14.1', dist);
            }
            
            // โคมไฟ
            if(ft==='LED_E27') addQty('4.1', pts); 
            else if(ft==='LED_PANEL') addQty('15.1', pts); 
            else if(ft==='T8_SET') addQty('15.2', pts);
        }
    }

    // 5. AC & Heater (Detailed Calculation)
    ['ac_wiring', 'heater_wiring'].forEach(prefix => {
        const count = getInt(`${prefix}_units`);
        const installType = document.getElementById(prefix==='ac_wiring'?'ac_install_type_4':'wh_install_type_5')?.value;
        
        for(let i=1; i<=count; i++) {
            const p2b = getVal(`${prefix}_${i}_panel_to_breaker_dist`);
            const b2u = getVal(`${prefix}_${i}_breaker_to_unit_dist`);
            const ground = getVal(`${prefix}_${i}_panel_to_unit_dist_ground`);
            const totalConduitDist = p2b + b2u; 
            const breakerDisplay = document.getElementById(`${prefix}_${i}_breaker_display`);
            const amps = breakerDisplay ? parseInt(breakerDisplay.dataset.amps || 0) : 0;

            if(totalConduitDist > 0 || ground > 0) {
                addQty('1.4', totalConduitDist); // สาย L,N (เบอร์ 4)
                addQty('1.5', ground); // สาย G
                
                // ท่อร้อยสาย
                if(totalConduitDist > 0) {
                    if(installType.includes('_pvc')) {
                        addQty(installType.includes('concealed')?'2.3':'2.1', totalConduitDist);
                        if(!installType.includes('trunking')) addQty('13.1', 2); // Fittings 
                    } else if(installType.includes('_emt')) {
                        addQty('2.2', totalConduitDist);
                        addQty('13.2', 2);
                    } else if(installType.includes('trunking')) {
                        addQty('14.1', totalConduitDist);
                    }
                }
                
                addQty('12.1', 1); // กล่องเบรกเกอร์ลอย
                if(amps > 0) {
                    if(amps <= 16) addQty('10.1', 1);
                    else if(amps <= 20) addQty('10.2', 1);
                    else if(amps <= 32) addQty('10.3', 1);
                }
            }
        }
    });

    // 6-19. งานอื่นๆ (ต่อจากส่วนที่ขาดหายไปในไฟล์เดิม)
    addQty('11.1', getInt('lan_points')); 
    addQty('11.2', getVal('lan_distance'));
    addQty('11.3', getInt('tv_points')); 
    addQty('11.4', getVal('tv_distance'));
    addQty('11.5', getInt('cctv_points'));
    
    addQty('7.1', getInt('heater_units')); // ติดตั้งเครื่องทำน้ำอุ่น
    addQty('5.1', getInt('ac_units')); // ติดตั้งแอร์
    
    addQty('5.3', getInt('pump_units')); 
    const pt = document.getElementById('wp_install_type_6')?.value;
    if(pt === 'vct_clip') {
        addQty('16.1', 15 * getInt('pump_units')); // สาย VCT
    } else if(pt === 'nyy_burial') { 
        addQty('16.2', 15 * getInt('pump_units')); // สาย NYY
        addQty('2.1', 15 * getInt('pump_units')); // ท่อ PVC (ฝังดินใช้อันนี้แทนไปก่อน)
    }
    
    addQty('5.4', getInt('fan_units'));
    
    if(document.getElementById('service_inspection')?.checked) addQty('8.1', 1);
    if(document.getElementById('service_leak_find')?.checked) addQty('8.2', 1);
    if(document.getElementById('service_trip_find')?.checked) addQty('8.3', 1);
    addQty('8.4', getInt('service_lamp_replace'));
    
    if(document.getElementById('toggle_ev_charger_visibility')?.checked && getVal('ev_cable_dist_8') > 0) {
        addQty('18.1', 1); // ค่าติดตั้ง EV
        if(document.getElementById('ev_install_type_8').value === 'new_meter_tou') addQty('18.2', 1);
        
        // Override ราคาเครื่องชาร์จถ้ามีการกรอก
        const evCost = getVal('ev_charger_cost_8'); 
        if(evCost > 0) setPrice('M-EV-CHARGER-7KW', evCost);
    }
    
    addQty('19.1', getInt('demo_lights_9')); 
    addQty('19.2', getInt('demo_outlets_9'));
    addQty('19.3', getInt('demo_cables_9')); 
    addQty('19.4', getInt('demo_ac_9'));
    
    if(document.getElementById('demo_include_repair_9')?.checked) {
        addQty('19.5', getInt('demo_lights_9') + getInt('demo_outlets_9'));
    }

    return quantities;
}

// --- Main Calculation Function ---
function performCalculation() {
    // ดึงค่า Auto Spec ของสายเมนที่คำนวณไว้
    const autoCableSize = document.getElementById('main_cable_spec_display')?.dataset.autoSize || 0;

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
            manualSize: document.getElementById('main_cable_size_7')?.value, // ถ้าผู้ใช้เลือกเอง
            autoSize: autoCableSize // ค่าที่ระบบแนะนำ
        }
    };
    
    return calculateProjectCost(buildQuantitiesFromDOM(), settings, manualPOItems, manualBOQItems);
}

function updateRealtimeTotal() {
    const costs = performCalculation();
    const totalEl = document.getElementById('total-display');
    if(totalEl) totalEl.textContent = `฿${formatCurrency(costs.totalWithVat)}`;
}

function displayReport() {
    const costs = performCalculation();
    const output = document.getElementById('output-section');
    if(output) {
        output.classList.remove('hidden');
        output.scrollIntoView({behavior:'smooth'});
        document.getElementById('report-content').innerHTML = generateReport(costs, activeTab).html;
    }
}

// --- Setup Functions (Export, Tabs, Manual Job) ---
function setupExportButtons() {
    document.getElementById('save-pdf-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('save-pdf-btn');
        const originalText = btn.innerText;
        btn.innerText = "กำลังสร้าง PDF..."; btn.disabled = true;
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const el = document.getElementById('output-section');
            
            // Hide non-printable elements
            el.querySelectorAll('.no-print').forEach(e => e.style.display = 'none');
            
            await doc.html(el, { 
                callback: (doc) => { 
                    doc.save('quotation.pdf'); 
                    el.querySelectorAll('.no-print').forEach(e => e.style.display = ''); 
                    btn.innerText = originalText; btn.disabled = false; 
                }, 
                x: 10, y: 10, width: 190, windowWidth: 1024 
            });
        } catch(e) { 
            console.error(e); 
            alert("เกิดข้อผิดพลาดในการสร้าง PDF");
            btn.innerText = originalText; btn.disabled = false; 
        }
    });

    document.getElementById('save-image-btn')?.addEventListener('click', () => {
        const el = document.getElementById('output-section');
        el.querySelectorAll('.no-print').forEach(e => e.style.display = 'none');
        html2canvas(el).then(canvas => {
            const link = document.createElement('a'); 
            link.download = 'quotation.png'; 
            link.href = canvas.toDataURL(); 
            link.click();
            el.querySelectorAll('.no-print').forEach(e => e.style.display = '');
        });
    });
}

function setupManualJobListeners() {
    const addBtn = document.getElementById('manual-job-add-btn');
    const addRowBtn = document.getElementById('manual-job-add-material-row');
    
    if(addRowBtn) {
        addRowBtn.addEventListener('click', () => {
            const tbody = document.querySelector('#manual-job-materials-table tbody');
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="text" class="form-input w-full manual-mat-desc" placeholder="รายการ"></td>
                <td><input type="number" class="form-input w-full manual-mat-qty" placeholder="0"></td>
                <td><input type="text" class="form-input w-full manual-mat-unit" placeholder="หน่วย"></td>
                <td><input type="number" class="form-input w-full manual-mat-price" placeholder="0.00"></td>
                <td><button class="btn-delete-row" onclick="this.closest('tr').remove()">×</button></td>
            `;
            tbody.appendChild(row);
        });
    }

    if(addBtn) {
        addBtn.addEventListener('click', () => {
            const name = document.getElementById('manual-job-name').value;
            const labor = parseFloat(document.getElementById('manual-job-labor-total').value) || 0;
            const qty = parseFloat(document.getElementById('manual-job-qty').value) || 1;
            const unit = document.getElementById('manual-job-unit').value || 'งาน';
            
            if(!name) return alert('กรุณาระบุชื่องาน');

            // Add Materials from table
            document.querySelectorAll('#manual-job-materials-table tbody tr').forEach((row, idx) => {
                const desc = row.querySelector('.manual-mat-desc').value;
                const mQty = parseFloat(row.querySelector('.manual-mat-qty').value) || 0;
                const mUnit = row.querySelector('.manual-mat-unit').value;
                const mPrice = parseFloat(row.querySelector('.manual-mat-price').value) || 0;
                
                if(desc && mQty > 0) {
                    manualPOItems.push({
                        id: `MANUAL_MAT_${Date.now()}_${idx}`,
                        description: desc,
                        spec: `(งาน: ${name})`,
                        quantity: mQty,
                        unit: mUnit,
                        unit_price: mPrice
                    });
                }
            });

            // Add to BOQ Summary
            // Calculate material cost per unit for BOQ
            let totalMatCost = 0;
            document.querySelectorAll('#manual-job-materials-table tbody tr').forEach(row => {
                totalMatCost += (parseFloat(row.querySelector('.manual-mat-qty').value)||0) * (parseFloat(row.querySelector('.manual-mat-price').value)||0);
            });

            manualBOQItems.push({
                description: name,
                quantity: qty,
                unit: unit,
                material_unit_cost: totalMatCost / qty,
                labor_unit_cost: labor / qty,
                material_id_code: 'MANUAL'
            });

            // Reset Form
            document.getElementById('manual-job-name').value = '';
            document.getElementById('manual-job-labor-total').value = '';
            document.querySelector('#manual-job-materials-table tbody').innerHTML = '';
            updateRealtimeTotal();
            if(!document.getElementById('output-section').classList.contains('hidden')) displayReport();
            alert('เพิ่มงานเรียบร้อยแล้ว');
        });
    }
}

function setupTabListeners() { 
    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', (e) => { 
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('tab-active')); 
        e.target.classList.add('tab-active'); 
        activeTab = e.target.dataset.tab; 
        displayReport(); 
    })); 
}

function populatePriceEditor() { 
    const tbody = document.getElementById('price-editor-body');
    if(!tbody) return;
    const prices = getPriceList();
    let html = '';
    for(const [id, price] of Object.entries(prices)) {
        if(price > 0) {
             html += `<tr class="border-b hover:bg-slate-50">
                <td class="p-2 text-xs text-slate-600 font-mono">${id}</td>
                <td class="p-2"><input type="number" class="form-input w-24 p-1 text-right text-sm" value="${price}" onchange="import('./modules/calculator.js').then(m => m.setPrice('${id}', parseFloat(this.value))); document.dispatchEvent(new Event('change'));"></td>
             </tr>`;
        }
    }
    tbody.innerHTML = html;
}

function setupCollapsibleCards() {
    document.querySelectorAll('.collapsible-card h3').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('open');
        });
    });
}
