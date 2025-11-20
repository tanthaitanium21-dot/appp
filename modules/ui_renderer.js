// modules/ui_renderer.js
// เวอร์ชันสมบูรณ์ Final (รวมทุกฟังก์ชันที่เคยหายไป และเพิ่มฟีเจอร์ระยะห่าง)

/**
 * ฟังก์ชันสำหรับสร้างฟอร์มวงจรไฟฟ้า (เต้ารับ/แสงสว่าง)
 * รองรับการสร้างช่องกรอกระยะห่างแบบไดนามิก
 */
export function renderCircuitInputs(prefix, count, container) {
    container.innerHTML = '';
    if (count <= 0) return;
    
    let html = '';
    for (let i = 1; i <= count; i++) {
        // สร้าง Label ตามประเภทงาน
        let distLabel = '';
        if (prefix === 'light') {
             distLabel = `
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-xs text-slate-500">ระยะตู้→สวิตช์ (ม.)</label>
                        <input type="number" id="${prefix}_circuit_${i}_dist_panel_to_switch" class="form-input mt-1 w-full" placeholder="0">
                    </div>
                    <div>
                        <label class="text-xs text-slate-500">ระยะสวิตช์→โคม (ม.)</label>
                        <input type="number" id="${prefix}_circuit_${i}_dist_switch_to_light" class="form-input mt-1 w-full" placeholder="0">
                    </div>
                </div>`;
        } else {
             distLabel = `
                <div>
                    <label class="text-sm text-slate-600">ระยะตู้ไฟถึงจุดแรก (ม.)</label>
                    <input type="number" id="${prefix}_circuit_${i}_panel_dist" class="form-input mt-1 w-full" placeholder="0">
                </div>`;
        }

        html += `
            <div class="circuit-container bg-gray-50 p-4 rounded-lg border border-gray-200 mb-3 shadow-sm" data-circuit-id="${prefix}-${i}">
                <div class="flex justify-between items-center mb-2">
                    <p class="font-bold text-blue-600">วงจรที่ ${i}</p>
                    <span class="text-xs text-gray-400 uppercase tracking-wider">${prefix}</span>
                </div>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <!-- ช่องกรอกระยะทางหลัก -->
                    ${distLabel}
                    
                    <!-- ช่องกรอกจำนวนจุด -->
                    <div>
                        <label class="text-sm text-slate-600">จำนวนจุดในวงจร</label>
                        <input type="number" id="${prefix}_circuit_${i}_points" 
                               data-prefix="${prefix}" 
                               data-index="${i}" 
                               class="point-count-input form-input mt-1 block w-full bg-white" 
                               value="1" min="1" placeholder="1">
                    </div>
                </div>
                
                <!-- พื้นที่สำหรับช่องกรอกระยะห่างเพิ่มเติม (Dynamic Inputs) -->
                <div id="${prefix}_circuit_${i}_extra_dist_container" class="mt-3 transition-all duration-300 ease-in-out"></div>
            </div>
        `;
    }
    container.innerHTML = html;
}

/**
 * ฟังก์ชันสำหรับสร้างช่องกรอกระยะห่างระหว่างจุด (Dynamic Inputs)
 * จะถูกเรียกโดย main.js เมื่อมีการเปลี่ยนตัวเลขในช่องจำนวนจุด
 */
export function renderDynamicInputs(prefix, index, points) {
    const container = document.getElementById(`${prefix}_circuit_${index}_extra_dist_container`);
    if (!container) return;

    // ถ้ามีจุดเดียว หรือไม่มีจุด ให้ล้างช่องกรอกระยะห่างออก
    if (points <= 1) {
        container.innerHTML = '';
        container.classList.remove('pl-4', 'border-l-4', 'border-blue-100', 'py-2');
        return;
    }

    // กำหนดหน่วยและคำแนะนำ
    const unitLabel = prefix === 'socket' ? 'ซม.' : 'ม.';
    const hintText = prefix === 'socket' 
        ? 'ระยะห่างจากจุดก่อนหน้า (ซม.)' 
        : 'ระยะห่างจากจุด/บล็อกก่อนหน้า (ม.)';

    let html = `
        <div class="bg-blue-50 p-3 rounded-md border border-blue-100">
            <p class="text-xs text-blue-700 font-semibold mb-2 flex items-center">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                ${hintText}
            </p>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
    `;
    
    // สร้างช่องกรอกตามจำนวนจุด (เริ่มจากจุดที่ 1 ไป 2, 2 ไป 3, ...)
    for (let j = 1; j < points; j++) {
        html += `
            <div class="relative">
                <label class="text-[10px] text-slate-500 absolute -top-2 left-2 bg-blue-50 px-1">
                    ${j} <span class="text-gray-300">→</span> ${j+1}
                </label>
                <input type="number" 
                       class="extra-dist-input form-input w-full py-1.5 text-sm text-center border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                       data-circuit="${prefix}-${index}" 
                       placeholder="0">
                <span class="absolute right-2 top-1.5 text-[10px] text-gray-400 pointer-events-none">${unitLabel}</span>
            </div>
        `;
    }
    html += `   </div>
             </div>`;
    
    container.innerHTML = html;
}

/**
 * ฟังก์ชันสำหรับสร้างฟอร์มวงจรเฉพาะจุด (แอร์/เครื่องทำน้ำอุ่น)
 */
export function renderDedicatedCircuitInputs(prefix, count, container) {
    container.innerHTML = '';
    if (count <= 0) return;
    
    const isAc = prefix === 'ac_wiring';
    const unitSelectorLabel = isAc ? 'ขนาด BTU' : 'ขนาด Watt';
    
    const unitOptions = isAc 
        ? `<option value="12000">9,000 - 12,000 BTU</option>
           <option value="18000">12,001 - 18,000 BTU</option>
           <option value="24000">18,001 - 24,000 BTU</option>
           <option value="30000">&gt; 24,000 BTU</option>`
        : `<option value="3500">&lt; 3,500 W</option>
           <option value="4500">3,501 - 4,500 W</option>
           <option value="6000">4,501 - 6,000 W</option>`;

    let html = '';
    for (let i = 1; i <= count; i++) {
        html += `
            <div class="circuit-container bg-gray-50 p-3 rounded-lg border border-gray-200 mb-2">
                <div class="flex items-center justify-between mb-2">
                    <p class="font-semibold text-gray-800">เครื่องที่ ${i}</p>
                    <span id="${prefix}_${i}_breaker_display" class="text-xs font-mono bg-gray-200 px-2 py-0.5 rounded text-gray-600">Breaker: Auto</span>
                </div>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                        <label class="text-xs text-slate-500">${unitSelectorLabel}</label>
                        <select id="${prefix}_${i}_unit_size" class="form-input mt-1 w-full text-sm">
                            ${unitOptions}
                        </select>
                    </div>
                    <div>
                        <label class="text-xs text-slate-500">ระยะสาย ตู้→เครื่อง (ม.)</label>
                        <input type="number" id="${prefix}_${i}_dist" class="form-input mt-1 w-full text-sm" placeholder="0">
                    </div>
                </div>
            </div>`;
    }
    container.innerHTML = html;
}

/**
 * ฟังก์ชันแปลงตัวเลขเป็นรูปแบบเงินบาท
 */
export function formatCurrency(num) {
    if (num === undefined || num === null || isNaN(num)) {
        return "0.00";
    }
    return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * ฟังก์ชันสร้างตารางสรุปผล
 */
export function createSummaryTable(summaryItems) {
    if (!summaryItems || summaryItems.length === 0) return '';

    let rows = summaryItems.map(item => `
        <tr class="${item.isTotal ? 'bg-blue-50 border-t-2 border-blue-200' : 'border-b border-gray-100'}">
            <td class="px-6 py-2 text-right font-semibold text-slate-700 ${item.isTotal ? 'text-base py-3' : 'text-sm'}">
                ${item.label}
            </td>
            <td class="px-6 py-2 text-right font-bold w-1/3 ${item.isTotal ? 'text-xl text-blue-700 py-3' : 'text-gray-800'}">
                ${formatCurrency(item.value)}
            </td>
        </tr>
    `).join('');
    
    return `
        <div class="mt-8 flex justify-end">
            <table class="w-full md:w-2/3 lg:w-1/2 bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200">
                ${rows}
            </table>
        </div>
    `;
}
