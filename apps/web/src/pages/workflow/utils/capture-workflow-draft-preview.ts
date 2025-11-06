import { toCanvas, toJpeg } from 'html-to-image';

const CROP_PADDING_PX = 12;
/** 控制 JPEG 体积，减轻 localStorage / 传输压力 */
const MAX_THUMB_CSS_PX = 420;
const FINAL_PIXEL_RATIO = 1;
const JPEG_QUALITY = 0.86;
const FALLBACK_IMAGE_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

function waitFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let n = 0;
    const tick = () => {
      n += 1;
      if (n >= count) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function captureFilter(node: HTMLElement): boolean {
  const classList = (node as HTMLElement | undefined)?.classList;
  if (!classList) {
    return true;
  }
  if (classList.contains('react-flow__controls')) {
    return false;
  }
  if (classList.contains('react-flow__minimap')) {
    return false;
  }
  return true;
}

const htmlToImageBase = {
  cacheBust: true,
  backgroundColor: '#ffffff',
  skipFonts: true,
  imagePlaceholder: FALLBACK_IMAGE_PLACEHOLDER,
  filter: captureFilter,
} as const;

async function tryToCanvas(flowEl: HTMLElement, pixelRatio: number): Promise<HTMLCanvasElement | null> {
  return await toCanvas(flowEl, {
    ...htmlToImageBase,
    pixelRatio,
  });
}

function clampCropToCanvas(
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  cw: number,
  ch: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const x0 = Math.max(0, Math.min(sx, cw));
  const y0 = Math.max(0, Math.min(sy, ch));
  const x1 = Math.max(x0, Math.min(sx + sw, cw));
  const y1 = Math.max(y0, Math.min(sy + sh, ch));
  return { sx: x0, sy: y0, sw: x1 - x0, sh: y1 - y0 };
}

/**
 * reactflow@11 无 instance.toImage({ crop: true })；对画布根节点截图并按节点 DOM 外接矩形裁剪，等价「仅内容区域」导出。
 */
export async function captureWorkflowDraftPreview(
  reactFlowRoot: HTMLElement | null,
): Promise<string | null> {
  if (!reactFlowRoot) {
    return null;
  }

  const flowEl = reactFlowRoot.querySelector('.react-flow') as HTMLElement | null;
  if (!flowEl) {
    return null;
  }

  await waitFrames(2);

  const nodeEls = flowEl.querySelectorAll('.react-flow__node');
  if (nodeEls.length === 0) {
    return null;
  }

  const captureRatio = Math.min(1.5, window.devicePixelRatio || 1);

  const canvas = await tryToCanvas(flowEl, captureRatio);
  if (!canvas) {
    return await toJpeg(flowEl, {
      ...htmlToImageBase,
      pixelRatio: 1,
      quality: JPEG_QUALITY,
    });
  }

  const rootRect = flowEl.getBoundingClientRect();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodeEls.forEach((el) => {
    const r = el.getBoundingClientRect();
    minX = Math.min(minX, r.left - rootRect.left);
    minY = Math.min(minY, r.top - rootRect.top);
    maxX = Math.max(maxX, r.right - rootRect.left);
    maxY = Math.max(maxY, r.bottom - rootRect.top);
  });

  const cropX = Math.max(0, Math.floor(minX - CROP_PADDING_PX));
  const cropY = Math.max(0, Math.floor(minY - CROP_PADDING_PX));
  const cropW = Math.ceil(maxX - minX + CROP_PADDING_PX * 2);
  const cropH = Math.ceil(maxY - minY + CROP_PADDING_PX * 2);

  if (!(cropW > 0) || !(cropH > 0)) {
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  }

  const sx = Math.floor(cropX * captureRatio);
  const sy = Math.floor(cropY * captureRatio);
  const sw = Math.floor(cropW * captureRatio);
  const sh = Math.floor(cropH * captureRatio);

  const { sx: csx, sy: csy, sw: csw, sh: csh } = clampCropToCanvas(
    sx,
    sy,
    sw,
    sh,
    canvas.width,
    canvas.height,
  );

  if (csw < 1 || csh < 1) {
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  }

  let outW = cropW;
  let outH = cropH;
  const maxDim = Math.max(outW, outH);
  if (maxDim > MAX_THUMB_CSS_PX) {
    const s = MAX_THUMB_CSS_PX / maxDim;
    outW = Math.round(outW * s);
    outH = Math.round(outH * s);
  }

  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(outW * FINAL_PIXEL_RATIO));
  out.height = Math.max(1, Math.round(outH * FINAL_PIXEL_RATIO));
  const ctx = out.getContext('2d');
  if (!ctx) {
    return null;
  }

  try {
    ctx.drawImage(canvas, csx, csy, csw, csh, 0, 0, out.width, out.height);
    return out.toDataURL('image/jpeg', JPEG_QUALITY);
  } catch (err) {
    console.error('err', err);
    return await toJpeg(flowEl, {
      ...htmlToImageBase,
      pixelRatio: 1,
      quality: JPEG_QUALITY,
    });
  }
}
