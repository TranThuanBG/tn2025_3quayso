// sync-manager.js
// File này xử lý đồng bộ dữ liệu giữa trang quản lý nhân viên và trang chính

class SyncManager {
    constructor() {
        this.STORAGE_KEYS = {
            EMPLOYEES: 'employeesData',
            EMPLOYEES_BACKUP: 'employeesDataOriginal',
            WINNERS: 'winnersData',
            SYNC_FLAG: 'syncNeeded'
        };
    }

    // ====== PHƯƠNG THỨC CHO TRANG QUẢN LÝ NHÂN VIÊN (nhap_nhan_vien.html) ======
    
    /**
     * Lưu danh sách và đánh dấu cần đồng bộ
     */
    saveAndSync(employees) {
        try {
            // Lưu danh sách chính
            localStorage.setItem(this.STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
            
            // Lưu backup gốc (cho chức năng Clear)
            localStorage.setItem(this.STORAGE_KEYS.EMPLOYEES_BACKUP, JSON.stringify(employees));
            
            // Đánh dấu cần đồng bộ
            localStorage.setItem(this.STORAGE_KEYS.SYNC_FLAG, 'true');
            
            console.log('✅ Đã lưu và đánh dấu đồng bộ:', employees.length, 'nhân viên');
            
            // Hiển thị thông báo cho người dùng
            this.showSyncNotification();
            
            return true;
        } catch (error) {
            console.error('❌ Lỗi khi lưu và đồng bộ:', error);
            return false;
        }
    }

    /**
     * Thêm nhân viên mới và đồng bộ
     */
    addEmployee(code, name, existingEmployees) {
        const newEmployee = {
            code: code.trim().toUpperCase(),
            name: name.trim()
        };

        // Kiểm tra trùng mã
        if (existingEmployees.some(emp => emp.code === newEmployee.code)) {
            throw new Error(`Mã nhân viên "${newEmployee.code}" đã tồn tại`);
        }

        const updatedEmployees = [...existingEmployees, newEmployee];
        return this.saveAndSync(updatedEmployees);
    }

    /**
     * Xóa nhân viên và đồng bộ
     */
    deleteEmployee(code, existingEmployees) {
        const updatedEmployees = existingEmployees.filter(emp => emp.code !== code);
        return this.saveAndSync(updatedEmployees);
    }

    /**
     * Import danh sách và đồng bộ
     */
    importEmployees(textData, existingEmployees) {
        const lines = textData.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const newEmployees = [];
        const errors = [];
        const existingCodes = new Set(existingEmployees.map(emp => emp.code));

        lines.forEach((line, index) => {
            try {
                let code = '';
                let name = '';

                // Phân tích dữ liệu từ nhiều định dạng
                if (line.includes(' - ')) {
                    const parts = line.split(' - ');
                    code = parts[0].trim();
                    name = parts.slice(1).join(' - ').trim();
                } else if (line.includes(';')) {
                    const parts = line.split(';');
                    code = parts[0].trim();
                    name = parts.slice(1).join(';').trim();
                } else if (line.includes('\t')) {
                    const parts = line.split('\t');
                    code = parts[0].trim();
                    name = parts.slice(1).join('\t').trim();
                } else if (line.includes(',')) {
                    const parts = line.split(',');
                    code = parts[0].trim();
                    name = parts.slice(1).join(',').trim();
                } else {
                    // Format: NV001 Nguyễn Văn A
                    const firstSpace = line.indexOf(' ');
                    if (firstSpace > 0) {
                        code = line.substring(0, firstSpace).trim();
                        name = line.substring(firstSpace + 1).trim();
                    } else {
                        code = line;
                        name = line;
                    }
                }

                code = code.toUpperCase();
                
                if (!code) {
                    errors.push(`Dòng ${index + 1}: Thiếu mã nhân viên`);
                    return;
                }

                if (existingCodes.has(code)) {
                    errors.push(`Dòng ${index + 1}: Mã "${code}" đã tồn tại`);
                    return;
                }

                newEmployees.push({ code, name });
                existingCodes.add(code);

            } catch (error) {
                errors.push(`Dòng ${index + 1}: Định dạng không hợp lệ`);
            }
        });

        if (errors.length > 0) {
            throw new Error(`Lỗi import:\n${errors.join('\n')}`);
        }

        if (newEmployees.length === 0) {
            throw new Error('Không có dữ liệu hợp lệ để import');
        }

        const updatedEmployees = [...existingEmployees, ...newEmployees];
        return {
            success: this.saveAndSync(updatedEmployees),
            count: newEmployees.length,
            employees: updatedEmployees
        };
    }

    /**
     * Xóa toàn bộ và đồng bộ
     */
    clearAllEmployees() {
        localStorage.removeItem(this.STORAGE_KEYS.EMPLOYEES);
        localStorage.removeItem(this.STORAGE_KEYS.EMPLOYEES_BACKUP);
        localStorage.setItem(this.STORAGE_KEYS.SYNC_FLAG, 'true');
        return true;
    }

    /**
     * Kiểm tra xem có cần đồng bộ không
     */
    checkSyncNeeded() {
        return localStorage.getItem(this.STORAGE_KEYS.SYNC_FLAG) === 'true';
    }

    /**
     * Đánh dấu đã đồng bộ xong
     */
    markSynced() {
        localStorage.removeItem(this.STORAGE_KEYS.SYNC_FLAG);
    }

    /**
     * Hiển thị thông báo đồng bộ
     */
    showSyncNotification() {
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #22c55e, #10b981);
                color: white;
                padding: 12px 20px;
                border-radius: 10px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 10px;
                animation: slideIn 0.3s ease-out;
            ">
                <span style="font-weight: bold;">✅ Đã lưu thành công!</span>
                <span>Dữ liệu sẽ tự động cập nhật trên trang vòng quay.</span>
                <button onclick="this.parentElement.remove()" style="
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    font-size: 18px;
                    margin-left: 10px;
                ">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Tự động xóa sau 5 giây
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    // ====== PHƯƠNG THỨC CHO TRANG CHÍNH (index.html) ======
    
    /**
     * Kiểm tra và đồng bộ dữ liệu khi trang chính load
     */
    syncOnMainPageLoad() {
        if (this.checkSyncNeeded()) {
            console.log('🔄 Phát hiện thay đổi, đang đồng bộ dữ liệu...');
            
            // Load lại dữ liệu từ localStorage
            const employees = this.loadEmployees();
            const winners = this.loadWinners();
            
            // Đánh dấu đã đồng bộ
            this.markSynced();
            
            // Trả về dữ liệu mới
            return {
                employees,
                winners,
                synced: true
            };
        }
        
        return { synced: false };
    }

    /**
     * Load danh sách nhân viên
     */
    loadEmployees() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEYS.EMPLOYEES);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Lỗi load employees:', error);
            return [];
        }
    }

    /**
     * Load danh sách người thắng
     */
    loadWinners() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEYS.WINNERS);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Lỗi load winners:', error);
            return [];
        }
    }
}

// ====== EXPORT CHO TRANG QUẢN LÝ ======
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SyncManager;
} else {
    window.SyncManager = SyncManager;
}