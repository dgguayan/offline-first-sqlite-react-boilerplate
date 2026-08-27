import { Crop, RefreshCcw, RotateCcw, RotateCw, Scan } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

const defaultFrameSize = 320;
const maximumLogoSize = 2 * 1024 * 1024;
const outputSizes = [256, 512, 1024] as const;

type Point = { x: number; y: number };
type LoadedImage = {
    element: HTMLImageElement;
    width: number;
    height: number;
};

type EditorProps = {
    open: boolean;
    sourceUrl: string | null;
    sourceName: string;
    onOpenChange: (open: boolean) => void;
    onApply: (file: File) => void;
};

export function LogoImageEditor({
    open,
    sourceUrl,
    sourceName,
    onOpenChange,
    onApply,
}: EditorProps) {
    const cropFrame = useRef<HTMLDivElement>(null);
    const drag = useRef<
        | (Point & { pointerId: number; originX: number; originY: number })
        | undefined
    >(undefined);
    const [image, setImage] = useState<LoadedImage | null>(null);
    const [frameSize, setFrameSize] = useState(defaultFrameSize);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
    const [outputSize, setOutputSize] = useState<number>(512);
    const [isDragging, setIsDragging] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || !sourceUrl) {
            return;
        }

        let cancelled = false;
        const nextImage = new Image();

        nextImage.onload = () => {
            if (cancelled) {
                return;
            }

            if (!nextImage.naturalWidth || !nextImage.naturalHeight) {
                setError('This image does not have a usable size.');

                return;
            }

            setImage({
                element: nextImage,
                width: nextImage.naturalWidth,
                height: nextImage.naturalHeight,
            });
            setError(null);
        };
        nextImage.onerror = () => {
            if (!cancelled) {
                setError('The selected logo could not be opened.');
            }
        };
        nextImage.src = sourceUrl;

        return () => {
            cancelled = true;
        };
    }, [open, sourceUrl]);

    useEffect(() => {
        if (!open || !cropFrame.current) {
            return;
        }

        const updateFrameSize = () => {
            const width = cropFrame.current?.getBoundingClientRect().width;

            if (width) {
                setFrameSize(width);
            }
        };
        const observer = new ResizeObserver(updateFrameSize);

        updateFrameSize();
        observer.observe(cropFrame.current);

        return () => observer.disconnect();
    }, [open]);

    const metrics = useMemo(
        () =>
            image
                ? calculateImageMetrics(
                      image.width,
                      image.height,
                      rotation,
                      zoom,
                      frameSize,
                  )
                : null,
        [frameSize, image, rotation, zoom],
    );
    const constrainedOffset = clampOffset(offset, metrics);

    const rotate = (degrees: number) => {
        setRotation((current) => (current + degrees + 360) % 360);
        setOffset({ x: 0, y: 0 });
    };

    const resetEdits = () => {
        setZoom(1);
        setRotation(0);
        setOffset({ x: 0, y: 0 });
        setOutputSize(512);
        setError(null);
    };

    const startDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!image) {
            return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            originX: constrainedOffset.x,
            originY: constrainedOffset.y,
        };
        setIsDragging(true);
    };

    const moveImage = (event: ReactPointerEvent<HTMLDivElement>) => {
        const activeDrag = drag.current;

        if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
            return;
        }

        setOffset(
            clampOffset(
                {
                    x: activeDrag.originX + event.clientX - activeDrag.x,
                    y: activeDrag.originY + event.clientY - activeDrag.y,
                },
                metrics,
            ),
        );
    };

    const stopDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (drag.current?.pointerId !== event.pointerId) {
            return;
        }

        drag.current = undefined;
        setIsDragging(false);
    };

    const applyEdits = async () => {
        if (!image || !metrics) {
            return;
        }

        setIsApplying(true);
        setError(null);

        try {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            if (!context) {
                throw new Error('Your browser could not prepare the logo.');
            }

            canvas.width = outputSize;
            canvas.height = outputSize;

            const outputRatio = outputSize / frameSize;
            context.translate(
                outputSize / 2 + constrainedOffset.x * outputRatio,
                outputSize / 2 + constrainedOffset.y * outputRatio,
            );
            context.rotate((rotation * Math.PI) / 180);
            context.scale(
                metrics.scale * outputRatio,
                metrics.scale * outputRatio,
            );
            context.drawImage(
                image.element,
                -image.width / 2,
                -image.height / 2,
            );

            const blob = await canvasToBlob(canvas);

            if (blob.size > maximumLogoSize) {
                throw new Error(
                    'The edited logo is larger than 2 MB. Choose a smaller output size.',
                );
            }

            const baseName =
                sourceName.replace(/\.[^.]+$/, '').trim() || 'system-logo';
            onApply(
                new File([blob], `${baseName}-edited.png`, {
                    type: 'image/png',
                }),
            );
            onOpenChange(false);
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : 'The edited logo could not be prepared.',
            );
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!isApplying) {
                    onOpenChange(nextOpen);
                }
            }}
        >
            <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Edit system logo</DialogTitle>
                    <DialogDescription>
                        Drag to crop, zoom to resize, then rotate or choose the
                        exported image size.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_13rem]">
                    <div className="flex min-w-0 justify-center rounded-lg bg-muted/50 p-3 sm:p-5">
                        <div
                            ref={cropFrame}
                            className={`relative aspect-square w-full max-w-80 touch-none overflow-hidden rounded-md border bg-[linear-gradient(45deg,var(--muted)_25%,transparent_25%),linear-gradient(-45deg,var(--muted)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--muted)_75%),linear-gradient(-45deg,transparent_75%,var(--muted)_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] shadow-inner ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                            onPointerDown={startDragging}
                            onPointerMove={moveImage}
                            onPointerUp={stopDragging}
                            onPointerCancel={stopDragging}
                        >
                            {image && metrics ? (
                                <img
                                    src={sourceUrl ?? undefined}
                                    alt="Logo crop preview"
                                    draggable={false}
                                    className="pointer-events-none absolute max-w-none select-none"
                                    style={{
                                        left: `calc(50% + ${constrainedOffset.x}px)`,
                                        top: `calc(50% + ${constrainedOffset.y}px)`,
                                        width: image.width * metrics.scale,
                                        height: image.height * metrics.scale,
                                        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                                    }}
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    {!error && <Spinner className="size-6" />}
                                </div>
                            )}
                            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-45 [&>*]:border-white/70">
                                <span className="border-r border-b" />
                                <span className="border-r border-b" />
                                <span className="border-b" />
                                <span className="border-r border-b" />
                                <span className="border-r border-b" />
                                <span className="border-b" />
                                <span className="border-r" />
                                <span className="border-r" />
                                <span />
                            </div>
                            <div className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-black/20 ring-inset" />
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <Label htmlFor="logo-editor-zoom">Zoom</Label>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {Math.round(zoom * 100)}%
                                </span>
                            </div>
                            <Input
                                id="logo-editor-zoom"
                                type="range"
                                min="1"
                                max="3"
                                step="0.01"
                                value={zoom}
                                disabled={!image || isApplying}
                                className="h-8 cursor-pointer px-0 shadow-none"
                                onChange={(event) =>
                                    setZoom(Number(event.target.value))
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Rotation</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={!image || isApplying}
                                    onClick={() => rotate(-90)}
                                >
                                    <RotateCcw />
                                    Left
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={!image || isApplying}
                                    onClick={() => rotate(90)}
                                >
                                    <RotateCw />
                                    Right
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {rotation} degrees
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="logo-output-size">
                                Output size
                            </Label>
                            <Select
                                value={String(outputSize)}
                                disabled={!image || isApplying}
                                onValueChange={(value) =>
                                    setOutputSize(Number(value))
                                }
                            >
                                <SelectTrigger
                                    id="logo-output-size"
                                    className="w-full"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {outputSizes.map((size) => (
                                        <SelectItem
                                            key={size}
                                            value={String(size)}
                                        >
                                            {size} × {size} px
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            disabled={!image || isApplying}
                            onClick={resetEdits}
                        >
                            <RefreshCcw />
                            Reset edits
                        </Button>

                        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                            <p className="flex items-center gap-2 font-medium text-foreground">
                                <Scan className="size-4" />
                                Square logo output
                            </p>
                            <p className="mt-1">
                                Transparent areas are preserved in the exported
                                PNG.
                            </p>
                        </div>
                    </div>
                </div>

                {error && (
                    <p className="text-sm text-destructive" role="alert">
                        {error}
                    </p>
                )}

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isApplying}
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        disabled={!image || isApplying}
                        onClick={applyEdits}
                    >
                        {isApplying ? <Spinner /> : <Crop />}
                        {isApplying ? 'Preparing…' : 'Apply crop'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function calculateImageMetrics(
    imageWidth: number,
    imageHeight: number,
    rotation: number,
    zoom: number,
    frameSize: number,
) {
    const swapsDimensions = rotation % 180 !== 0;
    const rotatedWidth = swapsDimensions ? imageHeight : imageWidth;
    const rotatedHeight = swapsDimensions ? imageWidth : imageHeight;
    const scale =
        Math.max(frameSize / rotatedWidth, frameSize / rotatedHeight) * zoom;

    return {
        scale,
        maximumOffsetX: Math.max(0, (rotatedWidth * scale - frameSize) / 2),
        maximumOffsetY: Math.max(0, (rotatedHeight * scale - frameSize) / 2),
    };
}

export function clampOffset(
    point: Point,
    metrics: ReturnType<typeof calculateImageMetrics> | null,
): Point {
    if (!metrics) {
        return { x: 0, y: 0 };
    }

    return {
        x: Math.max(
            -metrics.maximumOffsetX,
            Math.min(metrics.maximumOffsetX, point.x),
        ),
        y: Math.max(
            -metrics.maximumOffsetY,
            Math.min(metrics.maximumOffsetY, point.y),
        ),
    };
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        try {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);

                    return;
                }

                reject(new Error('The edited logo could not be exported.'));
            }, 'image/png');
        } catch {
            reject(
                new Error(
                    'This logo cannot be edited in the browser. Upload the original image again.',
                ),
            );
        }
    });
}
