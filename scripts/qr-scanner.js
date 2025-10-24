class QRScanner {
    constructor() {
        this.video = document.getElementById('qr-video');
        this.canvas = document.getElementById('qr-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.isScanning = false;
        this.currentStream = null;
        this.currentFacingMode = 'environment'; // 'user' for front camera, 'environment' for back
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.checkCameraPermissions();
    }

    setupEventListeners() {
        document.getElementById('start-scanner').addEventListener('click', () => {
            this.toggleScanner();
        });

        document.getElementById('toggle-camera').addEventListener('click', () => {
            this.switchCamera();
        });

        document.getElementById('manualSubmit').addEventListener('click', () => {
            this.handleManualInput();
        });

        // Allow Enter key for manual input
        document.getElementById('businessIdInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleManualInput();
            }
        });
    }

    async checkCameraPermissions() {
        try {
            const permissions = await navigator.permissions.query({ name: 'camera' });
            if (permissions.state === 'denied') {
                this.showError('Camera access is denied. Please enable camera permissions in your browser settings.');
            }
        } catch (error) {
            console.log('Camera permissions API not supported');
        }
    }

    async toggleScanner() {
        if (this.isScanning) {
            await this.stopScanner();
        } else {
            await this.startScanner();
        }
    }

    async startScanner() {
        try {
            const constraints = {
                video: {
                    facingMode: this.currentFacingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.currentStream;

            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve();
                };
            });

            this.isScanning = true;
            document.getElementById('start-scanner').innerHTML = '<i class="fas fa-stop"></i> Stop Scanner';
            document.getElementById('start-scanner').classList.add('btn-danger');
            
            this.scanFrame();

        } catch (error) {
            console.error('Error starting scanner:', error);
            this.showError('Unable to access camera. Please ensure you have granted camera permissions.');
        }
    }

    async stopScanner() {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }

        this.isScanning = false;
        document.getElementById('start-scanner').innerHTML = '<i class="fas fa-camera"></i> Start Scanner';
        document.getElementById('start-scanner').classList.remove('btn-danger');
    }

    async switchCamera() {
        await this.stopScanner();
        this.currentFacingMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';
        await this.startScanner();
    }

    scanFrame() {
        if (!this.isScanning) return;

        if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code) {
                this.handleQRCode(code.data);
            }
        }

        requestAnimationFrame(() => this.scanFrame());
    }

    async handleQRCode(data) {
        try {
            // Parse QR code data - expecting format like "SALONPRO-BUSINESS-{businessId}"
            let businessId = data;
            
            // Extract business ID from various possible QR code formats
            if (data.includes('SALONPRO-BUSINESS-')) {
                businessId = data.split('SALONPRO-BUSINESS-')[1];
            } else if (data.includes('business=')) {
                businessId = data.split('business=')[1];
            }

            // Validate business ID format (UUID)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(businessId)) {
                this.showError('Invalid QR code. Please scan a valid SalonPro QR code.');
                return;
            }

            await this.verifyAndRedirect(businessId);

        } catch (error) {
            console.error('Error processing QR code:', error);
            this.showError('Error processing QR code. Please try again.');
        }
    }

    async handleManualInput() {
        const businessId = document.getElementById('businessIdInput').value.trim();
        
        if (!businessId) {
            this.showError('Please enter a Business ID');
            return;
        }

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(businessId)) {
            this.showError('Invalid Business ID format. Please enter a valid Business ID.');
            return;
        }

        await this.verifyAndRedirect(businessId);
    }

    async verifyAndRedirect(businessId) {
        try {
            this.showMessage('Verifying business...', 'info');

            // Verify business exists and is active
            const { data: business, error } = await supabase
                .from('businesses')
                .select('id, business_name, is_active')
                .eq('id', businessId)
                .single();

            if (error || !business) {
                throw new Error('Business not found');
            }

            if (!business.is_active) {
                throw new Error('This business is currently inactive');
            }

            // Store business ID for booking process
            localStorage.setItem('selectedBusinessId', businessId);
            
            this.showMessage(`Redirecting to ${business.business_name}...`, 'success');

            // Check if user is logged in
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
                // User is logged in, redirect to booking
                setTimeout(() => {
                    window.location.href = 'customer-dashboard.html?page=book-appointment';
                }, 1500);
            } else {
                // User not logged in, redirect to login/register
                setTimeout(() => {
                    window.location.href = 'customer-register.html?business=' + businessId;
                }, 1500);
            }

        } catch (error) {
            console.error('Error verifying business:', error);
            this.showError(error.message || 'Business not found. Please check the Business ID and try again.');
        }
    }

    showMessage(message, type = 'info') {
        const resultDiv = document.getElementById('scanner-result');
        resultDiv.innerHTML = `
            <div class="result-message result-${type}">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        resultDiv.style.display = 'block';
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }
}

// Initialize QR scanner when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.qrScanner = new QRScanner();
});