// modules/ui_renderer.js
// UI Helpers: สร้างช่องกรอกข้อมูลแบบ Dynamic และ Format ตัวเลข

export function renderCircuitInputs(prefix, count, container) {
    container.innerHTML = '';
    if (count <= 0) return;
    
    let html = '';
    for (let i = 1; i <= count; i++) {
        let distLabel = '';
        // แสงสว่าง: แยกเป็น 2 ช่วง (ตู้->สวิตช์, สวิตช์->โคม)
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
            // เต้ารับ: ระยะเดียว
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
                    ${distLabel}
                    <div>
                        <label class="text-sm text-slate-600">จำนวนจุดในวงจร</label>
                        <input type="number" id="${prefix}_circuit_${i}_points" 
                               data-prefix="${prefix}" data-index="${i}" 
                               class="point-count-input form-input mt-1 block w-full bg-white" 
                               value="1" min="1" placeholder="1">
                    </div>
                </div>
                <!-- Container สำหรับระยะห่างระหว่างจุด (Dynamic) -->
                <div id="${prefix}_circuit_${i}_extra_dist_container" class="mt-3 transition-all duration-300 ease-in-out"></div>
            </div>
        `;
    }
    container.innerHTML = html;
}

export function renderDynamicInputs(prefix, index, points) {
    const container = document.getElementById(`${prefix}_circuit_${index}_extra_dist_container`);
    if (!container) return;
    
    // ถ้ามีแค่ 1 จุด ไม่ต้องมีระยะห่างระหว่างจุด
    if (points <= 1) { 
        container.innerHTML = ''; 
        container.classList.remove('pl-4', 'border-l-4', 'border-blue-100', 'py-2'); 
        return; 
    }

    // Socket ใช้หน่วย cm (เพื่อความสะดวก), Light ใช้ m
    const unitLabel = prefix === 'socket' ? 'ซม.' : 'ม.';
    const hintText = prefix === 'socket' ? 'ระยะห่างจากจุดก่อนหน้า (ซม.)' : 'ระยะห่างจากจุด/บล็อกก่อนหน้า (ม.)';

    let html = `
        <div class="bg-blue-50 p-3 rounded-md border border-blue-100">
            <p class="text-xs text-blue-700 font-semibold mb-2 flex items-center">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                ${hintText}
            </p>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">`;
            
    for (let j = 1; j < points; j++) {
        html += `
            <div class="relative">
                <label class="text-[10px] text-slate-500 absolute -top-2 left-2 bg-blue-50 px-1">
                    ${j} <span class="text-gray-300">→</span> ${j+1}
                </label>
                <input type="number" class="extra-dist-input form-input w-full py-1.5 text-sm text-center border-slate-300 focus:border-blue-500" 
                       data-circuit="${prefix}-${index}" placeholder="0">
                <span class="absolute right-2 top-1.5 text-[10px] text-gray-400 pointer-events-none">${unitLabel}</span>
            </div>`;
    }
    html += `</div></div>`;
    
    container.innerHTML = html;
    container.classList.add('pl-4', 'border-l-4', 'border-blue-100', 'py-2');
}

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
            <div class="circuit-container bg-gray-50 p-4 rounded-lg border border-gray-200 mb-3 shadow-sm">
                <div class="flex items-center justify-between mb-3 border-b pb-2">
                    <p class="font-bold text-gray-800">เครื่องที่ ${i}</p>
                    <!-- Display Breaker Label -->
                    <span id="${prefix}_${i}_breaker_display" class="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-1 rounded">Breaker: Auto</span>
                </div>
                
                <div class="grid grid-cols-1 gap-3">
                    <!-- แถว 1: ขนาดเครื่อง -->
                    <div>
                        <label class="text-xs font-medium text-slate-600">${unitSelectorLabel}</label>
                        <select id="${prefix}_${i}_unit_size" class="dedicated-unit-size form-input mt-1 w-full text-sm" 
                                data-display-id="${prefix}_${i}_breaker_display" data-type="${isAc ? 'ac' : 'wh'}">
                            ${unitOptions}
                        </select>
                    </div>
                    
                    <!-- แถว 2: ระยะทางละเอียด -->
                    <div class="grid grid-cols-2 gap-3 bg-white p-2 rounded border border-slate-100">
                        <div>
                            <label class="text-[10px] text-slate-500">ระยะ ตู้ไฟ→เบรกเกอร์ (ม.)</label>
                            <input type="number" id="${prefix}_${i}_panel_to_breaker_dist" class="form-input w-full text-sm" placeholder="0">
                        </div>
                        <div>
                            <label class="text-[10px] text-slate-500">ระยะ เบรกเกอร์→เครื่อง (ม.)</label>
                            <input type="number" id="${prefix}_${i}_breaker_to_unit_dist" class="form-input w-full text-sm" placeholder="0">
                        </div>
                    </div>

                    <!-- แถว 3: สายดิน -->
                    <div>
                        <label class="text-xs text-slate-600">ระยะสายดิน ตู้ไฟ→เครื่อง (ม.)</label>
                        <input type="number" id="${prefix}_${i}_panel_to_unit_dist_ground" class="form-input mt-1 w-full text-sm" placeholder="0">
                    </div>
                </div>
            </div>`;
    }
    container.innerHTML = html;
}

export function formatCurrency(num) {
    if (num === undefined || num === null || isNaN(num)) return "0.00";
    return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// นี่คือฟังก์ชันที่ขาดไป (เพิ่มกลับมาให้แล้วครับ)
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
