import type { ImageCropDialogProps } from "@/components/ImageCropDialog";

/**
 * react-easy-crop and <canvas> can't run in jsdom. Mock the dialog with this fake:
 *   vi.mock("@/components/ImageCropDialog", async () => (await import("./imageCrop")).imageCropMock);
 * "Aplicar recorte" returns a file named `recortada-<original name>`; the ratio is
 * exposed as `data-aspect`.
 */
export const imageCropMock = {
  ImageCropDialog: ({ file, aspect, onCancel, onCropped }: ImageCropDialogProps) => (
    <div role="dialog" aria-label="Recortar imagen" data-aspect={aspect}>
      <button type="button" onClick={() => onCropped(new File(["cropped"], `recortada-${file.name}`, { type: file.type }))}>
        Aplicar recorte
      </button>
      <button type="button" onClick={onCancel}>
        Cancelar recorte
      </button>
    </div>
  ),
};
