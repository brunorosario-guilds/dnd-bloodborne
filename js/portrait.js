/* ============================================================
   ECOS DO PASSADO — Portrait Upload & Crop
   Handles image upload, zoom, pan, and crop for character portrait
   ============================================================ */

const Portrait = {
  // State
  _imageData: null,
  _zoom: 100,
  _offsetX: 0,
  _offsetY: 0,
  _isDragging: false,
  _dragStartX: 0,
  _dragStartY: 0,
  _startOffsetX: 0,
  _startOffsetY: 0,
  _naturalWidth: 0,
  _naturalHeight: 0,

  // DOM references
  _els: {},

  /**
   * Initialize portrait system
   */
  init() {
    this._els = {
      frame: document.getElementById('portrait-frame'),
      area: document.getElementById('portrait-area'),
      placeholder: document.getElementById('portrait-placeholder'),
      img: document.getElementById('portrait-img'),
      upload: document.getElementById('portrait-upload'),
      uploadBtn: document.getElementById('portrait-upload-btn'),
      modal: document.getElementById('crop-modal'),
      cropPreview: document.getElementById('crop-preview'),
      cropImg: document.getElementById('crop-img'),
      cropZoom: document.getElementById('crop-zoom'),
      cropConfirm: document.getElementById('crop-confirm'),
      cropCancel: document.getElementById('crop-cancel'),
    };

    this._bindEvents();
  },

  /**
   * Bind all event listeners
   */
  _bindEvents() {
    // Upload triggers
    this._els.uploadBtn.addEventListener('click', () => this._els.upload.click());
    this._els.frame.addEventListener('click', (e) => {
      if (!this._imageData) {
        this._els.upload.click();
      }
    });

    // File selected
    this._els.upload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this._loadImage(file);
    });

    // Crop modal controls
    this._els.cropZoom.addEventListener('input', (e) => {
      this._zoom = parseInt(e.target.value);
      this._updateCropPreview();
    });

    this._els.cropConfirm.addEventListener('click', () => this._confirmCrop());
    this._els.cropCancel.addEventListener('click', () => this._closeCropModal());

    // Drag to pan in crop preview
    this._els.cropPreview.addEventListener('mousedown', (e) => this._onDragStart(e));
    document.addEventListener('mousemove', (e) => this._onDragMove(e));
    document.addEventListener('mouseup', () => this._onDragEnd());

    // Touch support
    this._els.cropPreview.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this._onDragStart({ clientX: touch.clientX, clientY: touch.clientY });
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (this._isDragging) {
        const touch = e.touches[0];
        this._onDragMove({ clientX: touch.clientX, clientY: touch.clientY });
      }
    }, { passive: false });

    document.addEventListener('touchend', () => this._onDragEnd());

    // Mouse wheel zoom in crop preview
    this._els.cropPreview.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -10 : 10;
      this._zoom = Utils.clamp(this._zoom + delta, 100, 400);
      this._els.cropZoom.value = this._zoom;
      this._updateCropPreview();
    }, { passive: false });
  },

  /**
   * Load an image file and open crop modal
   */
  _loadImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this._imageData = e.target.result;
      this._zoom = 100;
      this._offsetX = 0;
      this._offsetY = 0;
      this._els.cropZoom.value = 100;

      const img = this._els.cropImg;
      img.onload = () => {
        this._naturalWidth = img.naturalWidth;
        this._naturalHeight = img.naturalHeight;
        this._openCropModal();
        // Allow modal display:flex to render so offsetWidth evaluates correctly, fixing uninitialized dimensions
        setTimeout(() => {
          this._updateCropPreview();
        }, 10);
      };
      img.src = this._imageData;
    };
    reader.readAsDataURL(file);
  },

  /**
   * Open the crop modal
   */
  _openCropModal() {
    this._els.modal.classList.add('active');
  },

  /**
   * Close the crop modal
   */
  _closeCropModal() {
    this._els.modal.classList.remove('active');
    this._els.upload.value = '';
  },

  /**
   * Update the crop preview image position/scale
   */
  _updateCropPreview() {
    const img = this._els.cropImg;
    const preview = this._els.cropPreview;
    const pWidth = preview.offsetWidth;
    const pHeight = preview.offsetHeight;

    // Scale factor: fit image to cover the preview oval, then apply zoom
    const scale = (this._zoom / 100);
    const baseScale = Math.max(pWidth / this._naturalWidth, pHeight / this._naturalHeight);
    const totalScale = baseScale * scale;

    const scaledW = this._naturalWidth * totalScale;
    const scaledH = this._naturalHeight * totalScale;

    // Clamp offsets to prevent empty space holes during panning and zooming
    const maxOffsetX = Math.max(0, (scaledW - pWidth) / 2);
    const maxOffsetY = Math.max(0, (scaledH - pHeight) / 2);
    this._offsetX = Utils.clamp(this._offsetX, -maxOffsetX, maxOffsetX);
    this._offsetY = Utils.clamp(this._offsetY, -maxOffsetY, maxOffsetY);

    // Center by default, then apply offset
    const centerX = (pWidth - scaledW) / 2 + this._offsetX;
    const centerY = (pHeight - scaledH) / 2 + this._offsetY;

    img.style.width = scaledW + 'px';
    img.style.height = scaledH + 'px';
    img.style.left = centerX + 'px';
    img.style.top = centerY + 'px';
    img.style.transform = 'none';
  },

  /**
   * Drag handlers for panning
   */
  _onDragStart(e) {
    this._isDragging = true;
    this._dragStartX = e.clientX;
    this._dragStartY = e.clientY;
    this._startOffsetX = this._offsetX;
    this._startOffsetY = this._offsetY;
    this._els.cropPreview.style.cursor = 'grabbing';
  },

  _onDragMove(e) {
    if (!this._isDragging) return;
    const dx = e.clientX - this._dragStartX;
    const dy = e.clientY - this._dragStartY;
    this._offsetX = this._startOffsetX + dx;
    this._offsetY = this._startOffsetY + dy;
    this._updateCropPreview();
  },

  _onDragEnd() {
    this._isDragging = false;
    if (this._els.cropPreview) {
      this._els.cropPreview.style.cursor = 'grab';
    }
  },

  /**
   * Confirm crop and apply to portrait
   */
  _confirmCrop() {
    // Create a canvas to render the cropped oval area
    const canvas = document.createElement('canvas');
    const cWidth = 352;  // 2x resolution of 176x216 frame
    const cHeight = 432;
    canvas.width = cWidth;
    canvas.height = cHeight;
    const ctx = canvas.getContext('2d');

    // Draw oval clip
    ctx.beginPath();
    ctx.ellipse(cWidth / 2, cHeight / 2, cWidth / 2, cHeight / 2, 0, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Calculate the same transform as preview but mapped to canvas
    const preview = this._els.cropPreview;
    const pWidth = preview.offsetWidth;
    const pHeight = preview.offsetHeight;
    const ratio = cWidth / pWidth;

    const scale = (this._zoom / 100);
    const baseScale = Math.max(pWidth / this._naturalWidth, pHeight / this._naturalHeight);
    const totalScale = baseScale * scale;

    const scaledW = this._naturalWidth * totalScale * ratio;
    const scaledH = this._naturalHeight * totalScale * ratio;
    const centerX = (cWidth - scaledW) / 2 + this._offsetX * ratio;
    const centerY = (cHeight - scaledH) / 2 + this._offsetY * ratio;

    // Draw the source image
    const srcImg = new Image();
    srcImg.onload = () => {
      ctx.drawImage(srcImg, centerX, centerY, scaledW, scaledH);

      // Set as portrait
      const dataUrl = canvas.toDataURL('image/png');
      this._els.img.src = dataUrl;
      this._els.img.style.display = 'block';
      this._els.placeholder.style.display = 'none';

      this._closeCropModal();

      // Force Cloud Sync immediately after inserting avatar
      if (window.Cloud && window.Cloud.session) {
        window.Cloud.saveSheetState();
      }
    };
    srcImg.src = this._imageData;
  }
};
