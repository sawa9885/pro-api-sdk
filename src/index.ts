import earcut from 'earcut';
import JSZip from 'jszip';

interface PcbImagePrimitiveInfo {
	primitiveId: string;
	layer: number;
	filename?: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	mirror: boolean;
	mirrorRaw: unknown;
	blobReference?: string;
	blobHash?: string;
	binaryDataReference?: string;
	binaryDataKind?: 'data-url' | 'base64-png' | 'hash-or-reference' | 'empty';
	sourceLine?: number;
	sourceApi: 'document-source' | 'document-file' | 'primitive-image-api' | 'primitive-object-api';
}

interface FileSaveResult {
	method: 'save-dialog' | 'failed';
	path?: string;
	error?: string;
}

interface BlobRecoveryResult {
	primitiveId: string;
	filename?: string;
	blobReference?: string;
	recovered: boolean;
	sourcePath?: string;
	savedPath?: string;
	error?: string;
}

interface ExportPayload {
	generatedAt: string;
	source: 'eda.sys_FileManager.getDocumentSource' | 'eda.sys_FileManager.getDocumentFile' | 'eda.pcb_PrimitiveImage.getAll' | 'eda.pcb_PrimitiveObject.getAll';
	documentSourceAvailable: boolean;
	warnings: Array<string>;
	imagePrimitiveCount: number;
	imagePrimitives: Array<PcbImagePrimitiveInfo>;
	blobRecovery: {
		supported: boolean;
		note: string;
		results: Array<BlobRecoveryResult>;
	};
	notes: Array<string>;
}

interface BlobAsset {
	hash: string;
	filename: string;
	dataUrl: string;
	mimeType: string;
	sizeBytes: number;
	zipPath: string;
}

interface BoardCircleClip {
	centerX: number;
	centerY: number;
	radius: number;
	sourceLine: number;
}

interface BoardOutlineClip {
	id: string;
	points: Array<{ x: number; y: number }>;
	holes: Array<Array<{ x: number; y: number }>>;
	source: 'circle' | 'outline-segments' | 'obj-base-outline';
	zipPath?: string;
	sourceLine?: number;
	area: number;
	bounds: {
		left: number;
		right: number;
		top: number;
		bottom: number;
	};
	warnings: Array<string>;
}

interface BoardOutlineSegment {
	start: { x: number; y: number };
	end: { x: number; y: number };
	arcAngle?: number;
	sourceLine: number;
}

interface BoardOutlineCandidate extends BoardOutlineClip {
	score?: number;
	matchKind?: 'contained' | 'overlap-fallback';
	overlapRatio?: number;
	areaRatio?: number;
}

interface ObjMaterialGeometry {
	points: Array<{ x: number; y: number; z: number }>;
	faces: Array<Array<{ x: number; y: number; z: number }>>;
}

interface PcbComponentPlacement {
	componentId: string;
	footprintId?: string;
	layer: number;
	x: number;
	y: number;
	rotation: number;
}

interface FootprintPad {
	padId: string;
	number: string;
	layer: number;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	shape: 'rect' | 'ellipse' | 'oval';
	drill?: FootprintPadDrill;
}

interface FootprintPadDrill {
	shape: 'round' | 'slot';
	width: number;
	height: number;
}

interface GeneratedPad {
	componentId: string;
	footprintId: string;
	padId: string;
	number: string;
	componentLayer: number;
	layer: number;
	transform: 'top' | 'bottom-mirrored-xy' | 'top-board-y' | 'bottom-mirrored-xy-board-y' | 'pcb-absolute-board-y';
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	shape: FootprintPad['shape'];
	drill?: FootprintPadDrill;
}

interface GeneratedCopperCircle {
	primitiveId: string;
	net: string;
	layer: number;
	centerX: number;
	centerY: number;
	radius: number;
	width: number;
}

interface ProbePayload {
	probeName: string;
	api: string;
	startedAt: string;
	finishedAt: string;
	status: 'returned' | 'threw';
	elapsedMs: number;
	result?: unknown;
	error?: string;
	notes: Array<string>;
}

interface ObjZipAssets {
	zip: JSZip;
	objPath: string;
	mtlPath: string;
	objText: string;
	mtlText: string;
}

interface BaseObjFilterResult {
	objText: string;
	strippedMaterials: Array<string>;
	strippedFaceCount: number;
}

interface MaterialRewriteResult {
	mtlText: string;
	recoloredMaterials: Array<string>;
}

interface BoardTextureBinding {
	primitive: PcbImagePrimitiveInfo;
	textureAsset: { hash: string; path: string; fileName: string; blob: BlobAsset };
	materialName: string;
	isBottom: boolean;
}

const EXPORT_BASENAME = 'better-export-pcb-image-primitives';
const DOCUMENT_SOURCE_TIMEOUT_MS = 15000;
const PROBE_BASENAME = 'better-export-api-probe';
const EASYEDA_UNITS_PER_MM = 39.37007874;
const TOP_TEXTURE_Z = 0.035;
const BOTTOM_TEXTURE_Z = -1.645;
const TOP_BOARD_Z = 0;
const BOTTOM_BOARD_Z = -1.61;
const TOP_PAD_Z = 0.08;
const BOTTOM_PAD_Z = -1.692;
const BOTTOM_COPPER_Z = BOTTOM_PAD_Z;
const GENERATED_PAD_Y_AXIS_FLIP = true;
const CIRCLE_CLIP_SEGMENTS = 128;
const COPPER_CIRCLE_SEGMENTS = 192;
const PAD_CURVE_SEGMENTS = 48;
const TEXTURE_EDGE_INSET_SOURCE_UNITS = EASYEDA_UNITS_PER_MM * 0.08;
const FULL_3D_EXPORT_ELEMENTS: Array<'Component Model' | 'Via' | 'Silkscreen' | 'Wire In Signal Layer'> = [
	'Component Model',
];

export function activate(status?: 'onStartupFinished', arg?: string): void {
	void status;
	void arg;
}

export function checkBetterExport(): void {
	showInfo('BetterExport is installed and EasyEDA can run its menu callbacks.', 'BetterExport Check');
}

export function exportDebugTestJson(): void {
	void runExportDebugTestJson();
}

export function exportPcbImagePrimitiveInfo(): void {
	void runExportFromDocumentFile();
}

export function exportTexturedObj(): void {
	void runExportTexturedObj();
}

export function exportPlacementOnlyFallback(): void {
	void runExportPrimitiveImagePlacementInfo();
}

export function tryRawDocumentSourceExport(): void {
	void runRawDocumentSourceExport();
}

export function probePrimitiveImageGetAll(): void {
	void runApiProbe(
		'PrimitiveImage.getAll',
		'eda.pcb_PrimitiveImage.getAll()',
		'Known working placement-only API. It should return quickly and save a probe JSON.',
		async () => {
			const primitives = await eda.pcb_PrimitiveImage.getAll();
			return {
				count: primitives.length,
				items: primitives.map(primitive => ({
					primitiveId: primitive.getState_PrimitiveId(),
					layer: Number(primitive.getState_Layer()),
					x: primitive.getState_X(),
					y: primitive.getState_Y(),
					width: primitive.getState_Width(),
					height: primitive.getState_Height(),
					rotation: primitive.getState_Rotation(),
					horizonMirror: primitive.getState_HorizonMirror(),
				})),
			};
		},
	);
}

export function probeDocumentFile(): void {
	void runApiProbe(
		'FileManager.getDocumentFile',
		'eda.sys_FileManager.getDocumentFile(undefined, undefined, "epro2")',
		'Tests whether EasyEDA can return the current document as a file from installed-extension mode.',
		async () => summarizeFileResult(await eda.sys_FileManager.getDocumentFile(undefined, undefined, 'epro2')),
	);
}

export function probeProjectFile(): void {
	void runApiProbe(
		'FileManager.getProjectFile',
		'eda.sys_FileManager.getProjectFile(undefined, undefined, "epro2")',
		'Tests whether EasyEDA can return the current project as a file from installed-extension mode.',
		async () => summarizeFileResult(await eda.sys_FileManager.getProjectFile(undefined, undefined, 'epro2')),
	);
}

export function probe3dObjFile(): void {
	void runApiProbe(
		'ManufactureData.get3DFile OBJ',
		'eda.pcb_ManufactureData.get3DFile("better-export-probe-3d", "obj", ["Silkscreen"])',
		'Tests whether the built-in 3D OBJ exporter is callable and whether its file can be saved for inspection.',
		async () => summarizeFileResult(await eda.pcb_ManufactureData.get3DFile('better-export-probe-3d', 'obj', ['Silkscreen'])),
	);
}

export function probePrimitiveObjectGetAllDangerous(): void {
	void runApiProbe(
		'PrimitiveObject.getAll DANGEROUS',
		'eda.pcb_PrimitiveObject.getAll()',
		'This API has hung in this EasyEDA setup. Run only when you are ready to restart EasyEDA if it does not return.',
		async () => {
			const primitives = await eda.pcb_PrimitiveObject.getAll();
			return {
				count: primitives.length,
				items: primitives.map(primitive => ({
					primitiveId: primitive.getState_PrimitiveId(),
					layer: toNumber(primitive.getState_Layer()),
					filename: primitive.getState_FileName(),
					topLeftX: toNumber(primitive.getState_TopLeftX()),
					topLeftY: toNumber(primitive.getState_TopLeftY()),
					width: primitive.getState_Width(),
					height: primitive.getState_Height(),
					rotation: primitive.getState_Rotation(),
					mirror: primitive.getState_Mirror(),
					binaryDataSummary: summarizeText(primitive.getState_BinaryData(), 240),
				})),
			};
		},
	);
}

export function probeDocumentSourceDangerous(): void {
	void runApiProbe(
		'FileManager.getDocumentSource DANGEROUS',
		'eda.sys_FileManager.getDocumentSource()',
		'This API has hung in this EasyEDA setup. Run only when you are ready to restart EasyEDA if it does not return.',
		async () => {
			const source = await eda.sys_FileManager.getDocumentSource();
			return {
				defined: source !== undefined,
				length: source?.length ?? 0,
				objImageLineCount: source ? parseImageObjLines(source).length : 0,
				firstObjImageLines: source ? parseImageObjLines(source).slice(0, 10) : [],
				sourcePreview: source ? summarizeText(source, 1200) : undefined,
			};
		},
	);
}

async function runExportDebugTestJson(): Promise<void> {
	try {
		const fileName = `${EXPORT_BASENAME}-debug-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
		const blob = new Blob([JSON.stringify({
			generatedAt: new Date().toISOString(),
			message: 'If this file saved, EasyEDA sys_FileSystem.saveFile works for BetterExport.',
		}, null, 2)], { type: 'application/json;charset=utf-8' });

		await eda.sys_FileSystem.saveFile(blob, fileName);
		showInfo(`Debug JSON save completed.\n\nFilename:\n${fileName}\n\nThe file is wherever you selected in the save dialog.`, 'BetterExport Debug');
	}
	catch (error) {
		showInfo(`Debug JSON save failed:\n${getErrorMessage(error)}`, 'BetterExport Debug Error');
	}
}

async function runExportFromDocumentFile(): Promise<void> {
	try {
		showToast('BetterExport: exporting current document file.', 'info', 5000);
		const documentFile = await eda.sys_FileManager.getDocumentFile(undefined, undefined, 'epro2');
		if (!documentFile) {
			showInfo('EasyEDA returned no document file. Open a PCB document and try again.', 'BetterExport Export');
			return;
		}

		const parsed = await parseEasyEdaDocumentFile(documentFile);
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const pngResults = await saveRecoveredPngs(parsed.imagePrimitives, parsed.blobsByHash, timestamp);
		const blobRecoveryResults = parsed.imagePrimitives.map((primitive) => {
			const pngResult = primitive.blobHash
				? pngResults.find(result => result.hash === primitive.blobHash)
				: undefined;
			return {
				primitiveId: primitive.primitiveId,
				filename: primitive.filename,
				blobReference: primitive.blobReference,
				recovered: Boolean(pngResult?.saved),
				savedPath: pngResult?.fileName,
				error: pngResult?.error,
			};
		});
		const warnings = parsed.warnings;
		const payload: ExportPayload = {
			generatedAt: new Date().toISOString(),
			source: 'eda.sys_FileManager.getDocumentFile',
			documentSourceAvailable: true,
			warnings,
			imagePrimitiveCount: parsed.imagePrimitives.length,
			imagePrimitives: parsed.imagePrimitives,
			blobRecovery: {
				supported: pngResults.some(result => result.saved),
				note: pngResults.some(result => result.saved)
					? 'Recovered PNG bytes from BLOB/*.eblob entries in the EasyEDA document file.'
					: 'No matching BLOB data URL was found for the image primitive blob references.',
				results: blobRecoveryResults,
			},
			notes: [
				'Document file export is a ZIP. PCB/*.epcb contains OBJ placement rows; BLOB/*.eblob contains image data URLs keyed by blob hash.',
				'EasyEDA Pro OBJ/MTL export emits flat material colors and does not include map_Kd texture references for these image primitives.',
			],
		};

		const outputName = `${EXPORT_BASENAME}-${timestamp}.json`;
		const saveResult = await saveJsonPayload(payload, outputName);
		showSummary(parsed.imagePrimitives, saveResult, blobRecoveryResults, warnings);
	}
	catch (error) {
		showInfo(`Document-file export failed:\n${getErrorMessage(error)}`, 'BetterExport Error');
	}
}

async function runExportTexturedObj(): Promise<void> {
	let stage = 'starting';
	try {
		showToast('BetterExport: preparing textured OBJ export.', 'info', 5000);
		stage = 'reading EasyEDA document file';
		const documentFile = await eda.sys_FileManager.getDocumentFile(undefined, undefined, 'epro2');
		if (!documentFile) {
			showInfo('EasyEDA returned no document file. Open a PCB document and try again.', 'BetterExport Textured OBJ');
			return;
		}

		stage = 'parsing EasyEDA document file';
		const parsed = await parseEasyEdaDocumentFile(documentFile);
		if (parsed.imagePrimitives.length === 0) {
			showInfo('No PCB image primitives were found in the current document.', 'BetterExport Textured OBJ');
			return;
		}

		stage = 'requesting EasyEDA OBJ export';
		const objFile = await eda.pcb_ManufactureData.get3DFile('better-export-textured-obj', 'obj', FULL_3D_EXPORT_ELEMENTS, 'Outfit', true);
		if (!objFile) {
			showInfo('EasyEDA did not return a 3D OBJ file.', 'BetterExport Textured OBJ');
			return;
		}

		stage = 'reading EasyEDA OBJ ZIP';
		const objAssets = await readObjZipAssets(objFile);
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		stage = 'recovering image textures';
		const textureAssets = collectTextureAssets(parsed.imagePrimitives, parsed.blobsByHash, timestamp);
		const baseObjForClip = keepBaseObjSignalMaterials(objAssets.objText, objAssets.mtlText);
		stage = 'deriving board clip';
		const effectiveBoardClip = parsed.boardClip
			?? deriveBoardClipFromBaseObj(baseObjForClip.objText, parsed.imagePrimitives, parsed.warnings);
		if (effectiveBoardClip && !parsed.boardClip) {
			addBoardSlotHolesToBoardClip(effectiveBoardClip, parsed.boardSlotHoles);
			addGeneratedPadDrillHolesToBoardClip(effectiveBoardClip, parsed.generatedPads);
		}
		stage = 'rewriting OBJ materials';
		const generatedBoardBodyMaterials = effectiveBoardClip
			? getBaseObjBoardBodyMaterials(objAssets.objText, effectiveBoardClip)
			: [];
		const baseObjFilter = stripBaseObjSignalMaterials(objAssets.objText, objAssets.mtlText, generatedBoardBodyMaterials);
		const materialRewrite = rewriteBaseSignalMaterialsToEnig(
			objAssets.mtlText,
			generatedBoardBodyMaterials,
		);
		stage = 'baking image geometry into OBJ';
		const baked = bakeImageQuadsIntoObj(
			baseObjFilter.objText,
			materialRewrite.mtlText,
			parsed.imagePrimitives,
			textureAssets,
			effectiveBoardClip,
			parsed.generatedPads,
			parsed.generatedCopperCircles,
		);

		stage = 'writing OBJ ZIP entries';
		objAssets.zip.file(objAssets.objPath, baked.objText);
		objAssets.zip.file(objAssets.mtlPath, baked.mtlText);
		for (const textureAsset of textureAssets) {
			objAssets.zip.file(textureAsset.path, dataUrlToUint8Array(textureAsset.blob.dataUrl));
			objAssets.zip.file(textureAsset.fileName, dataUrlToUint8Array(textureAsset.blob.dataUrl));
		}
		objAssets.zip.file(
			'better-export-image-primitives.json',
			JSON.stringify({
				generatedAt: new Date().toISOString(),
				warnings: parsed.warnings,
				imagePrimitives: parsed.imagePrimitives,
				textures: textureAssets.map(asset => ({
					hash: asset.hash,
					filename: asset.blob.filename,
					path: asset.path,
					rootPath: asset.fileName,
					mimeType: asset.blob.mimeType,
					sizeBytes: asset.blob.sizeBytes,
				})),
				textureMappings: getTextureMappingDiagnostics(parsed.imagePrimitives, effectiveBoardClip),
				objExport: {
					elements: FULL_3D_EXPORT_ELEMENTS,
					modelMode: 'Outfit',
					autoGenerateModels: true,
				},
				materialRewrite: {
					finish: 'ENIG-like gold for likely EasyEDA signal/copper materials',
					recoloredMaterials: materialRewrite.recoloredMaterials,
					excludedMaterials: generatedBoardBodyMaterials,
				},
				baseObjFilter: {
					strippedMaterials: baseObjFilter.strippedMaterials,
					strippedFaceCount: baseObjFilter.strippedFaceCount,
					note: 'Likely EasyEDA-generated blue signal/body overlay material faces are stripped from the final OBJ. BetterExport-generated ENIG pads are used above the recovered image texture instead.',
				},
				boardClip: effectiveBoardClip,
				generatedPads: {
					count: parsed.generatedPads.length,
					items: parsed.generatedPads,
				},
				generatedCopperCircles: {
					count: parsed.generatedCopperCircles.length,
					items: parsed.generatedCopperCircles,
				},
				notes: [
					'BetterExport injected textured quads because the EasyEDA OBJ has no UV coordinates for image primitives.',
					'Texture PNGs are written both beside the OBJ/MTL and under textures/ because Blender resolves root-level OBJ texture paths more reliably.',
					'Bottom-side image primitive coordinates are mirrored by EasyEDA; BetterExport treats the bottom x coordinate as the right edge of the image box.',
					'When a board outline is detected, BetterExport clips the injected image geometry to that outline instead of exporting a square image plane.',
					'Likely EasyEDA blue signal/body overlay geometry is stripped from the base OBJ after board-outline detection so it does not cover the recovered texture.',
					'The top image decal is placed close to the board surface and acts as the visual board face.',
					'Top-layer footprint PAD rows are converted into raised BetterExport ENIG pad meshes above the recovered board image.',
					'Bottom-layer circular copper POLY strokes are converted into bright ENIG annulus meshes below the board image decal.',
					'Object/group records are collapsed so Blender imports the OBJ as one object even when Split By Object is enabled.',
				],
			}, null, 2),
		);

		stage = 'generating output ZIP';
		const outputBlob = await objAssets.zip.generateAsync({ type: 'blob', compression: 'STORE' });
		const outputName = `better-export-textured-obj-${timestamp}.zip`;
		stage = 'saving output ZIP';
		await eda.sys_FileSystem.saveFile(outputBlob, outputName);
		showInfo(
			`Textured OBJ export complete.\n\nImage primitives: ${parsed.imagePrimitives.length}\nTexture files: ${textureAssets.length}\nOutput:\n${outputName}`,
			'BetterExport Textured OBJ',
		);
	}
	catch (error) {
		showInfo(`Textured OBJ export failed during ${stage}:\n${getErrorMessage(error)}`, 'BetterExport Textured OBJ Error');
	}
}

async function readObjZipAssets(file: File): Promise<ObjZipAssets> {
	const zip = await JSZip.loadAsync(file);
	const objPath = Object.keys(zip.files).find(path => path.toLowerCase().endsWith('.obj'));
	const mtlPath = Object.keys(zip.files).find(path => path.toLowerCase().endsWith('.mtl'));
	if (!objPath || !mtlPath) {
		throw new Error('EasyEDA OBJ export ZIP did not contain both .obj and .mtl files.');
	}

	return {
		zip,
		objPath,
		mtlPath,
		objText: await zip.file(objPath)!.async('text'),
		mtlText: await zip.file(mtlPath)!.async('text'),
	};
}

function deriveBoardClipFromBaseObj(
	objText: string,
	imagePrimitives: Array<PcbImagePrimitiveInfo>,
	warnings: Array<string>,
): BoardOutlineClip | undefined {
	const imageBoxes = imagePrimitives.map(getPrimitiveSourceBox);
	if (imageBoxes.length === 0) {
		return undefined;
	}

	const vertices: Array<{ x: number; y: number; z: number } | undefined> = [undefined];
	const materialGeometries = new Map<string, ObjMaterialGeometry>();
	let activeMaterial = '';

	for (const line of objText.split(/\r?\n/)) {
		if (line.startsWith('v ')) {
			const [, xText, yText, zText] = line.trim().split(/\s+/);
			vertices.push({ x: toNumber(xText), y: toNumber(yText), z: toNumber(zText) });
			continue;
		}

		if (line.startsWith('usemtl ')) {
			activeMaterial = line.split(/\s+/, 2)[1] ?? '';
			continue;
		}

		if (!activeMaterial || activeMaterial.startsWith('better_export_') || !line.startsWith('f ')) {
			continue;
		}

		const geometry = materialGeometries.get(activeMaterial) ?? { points: [], faces: [] };
		const facePoints: Array<{ x: number; y: number; z: number }> = [];
		for (const token of line.trim().split(/\s+/).slice(1)) {
			const vertexIndex = Number.parseInt(token.split('/')[0], 10);
			const vertex = vertices[vertexIndex];
			if (vertex) {
				const point = objPointToSourcePoint(vertex.x, vertex.y, vertex.z);
				geometry.points.push(point);
				facePoints.push(point);
			}
		}
		if (facePoints.length >= 3) {
			geometry.faces.push(facePoints);
		}
		materialGeometries.set(activeMaterial, geometry);
	}

	const candidates = [...materialGeometries.entries()]
		.map(([material, geometry]) => createObjBoardCandidate(material, geometry, imageBoxes))
		.filter((candidate): candidate is BoardOutlineCandidate => Boolean(candidate))
		.sort((left, right) => (right.score ?? 0) - (left.score ?? 0));

	const selected = candidates[0];
	if (!selected || (selected.score ?? 0) <= 0) {
		warnings.push(`OBJ base outline fallback found ${materialGeometries.size} material group(s), but no board-like material overlapped the image primitive bounds.`);
		return undefined;
	}

	warnings.push(`Selected OBJ-derived board outline from material ${selected.id} with overlap ratio ${formatNumber(selected.overlapRatio ?? 0)}.`);
	return selected;
}

function createObjBoardCandidate(
	material: string,
	geometry: ObjMaterialGeometry,
	imageBoxes: Array<{ left: number; right: number; top: number; bottom: number }>,
): BoardOutlineCandidate | undefined {
	const uniquePoints = dedupePoints(geometry.points, 0.01);
	if (uniquePoints.length < 3) {
		return undefined;
	}

	const planarOutline = getLargestPlanarBoundaryLoop(geometry.faces, 0.01);
	const silhouetteOutline = planarOutline ? undefined : getProjectedSilhouetteLoop(uniquePoints, 720);
	const outline = planarOutline ?? silhouetteOutline ?? getConvexHull(uniquePoints);
	if (outline.length < 3) {
		return undefined;
	}
	const outlineMethod = planarOutline
		? 'top planar boundary edges'
		: silhouetteOutline
			? 'projected outer silhouette'
			: 'convex hull fallback';

	const bounds = getPointBounds(outline);
	const area = Math.abs(getPolygonSignedArea(outline));
	const match = imageBoxes.map((box) => {
		const imageArea = getBoundsArea(box);
		const overlapRatio = imageArea > 0 ? getBoundsOverlapArea(box, bounds) / imageArea : 0;
		const areaRatio = imageArea > 0 ? area / imageArea : 0;
		const sizePenalty = areaRatio > 1.2 ? areaRatio - 1.2 : areaRatio < 0.15 ? 0.15 - areaRatio : 0;
		return {
			score: overlapRatio - sizePenalty,
			overlapRatio,
			areaRatio,
		};
	}).sort((left, right) => right.score - left.score)[0];

	if (!match || match.overlapRatio <= 0.05) {
		return undefined;
	}

	return {
		id: material,
		points: outline,
		holes: [],
		source: 'obj-base-outline',
		area,
		bounds,
		warnings: [
			'Board outline was derived from EasyEDA base OBJ geometry because no PCB outline rows were parsed from the document file.',
			`OBJ-derived outline uses ${outlineMethod} of the selected base material projected into PCB coordinates.`,
		],
		score: match.score,
		matchKind: 'overlap-fallback',
		overlapRatio: match.overlapRatio,
		areaRatio: match.areaRatio,
	};
}

function getProjectedSilhouetteLoop(
	points: Array<{ x: number; y: number }>,
	binCount: number,
): Array<{ x: number; y: number }> | undefined {
	if (points.length < 3 || binCount < 12) {
		return undefined;
	}

	const bounds = getPointBounds(points);
	const center = {
		x: (bounds.left + bounds.right) / 2,
		y: (bounds.top + bounds.bottom) / 2,
	};
	const bins: Array<{ x: number; y: number; radius: number } | undefined> = Array.from({ length: binCount });
	const radii: Array<number | undefined> = Array.from({ length: binCount });

	for (const point of points) {
		const deltaX = point.x - center.x;
		const deltaY = point.y - center.y;
		const radius = Math.hypot(deltaX, deltaY);
		if (radius <= 0) {
			continue;
		}

		const angle = Math.atan2(deltaY, deltaX);
		const normalized = angle < 0 ? angle + Math.PI * 2 : angle;
		const binIndex = Math.min(binCount - 1, Math.floor((normalized / (Math.PI * 2)) * binCount));
		const existing = bins[binIndex];
		if (!existing || radius > existing.radius) {
			bins[binIndex] = { x: point.x, y: point.y, radius };
			radii[binIndex] = radius;
		}
	}

	const populatedRadii = radii.filter((radius): radius is number => radius !== undefined).sort((left, right) => left - right);
	if (populatedRadii.length < 12) {
		return undefined;
	}
	const fallbackRadius = populatedRadii[Math.floor(populatedRadii.length * 0.75)];
	const smoothedRadii = radii.map((radius, index) => {
		const neighborhood: Array<number> = [];
		const windowSize = 6;
		for (let offset = -windowSize; offset <= windowSize; offset += 1) {
			const neighborIndex = (index + offset + binCount) % binCount;
			const neighborRadius = radii[neighborIndex];
			if (neighborRadius !== undefined) {
				neighborhood.push(neighborRadius);
			}
		}

		const localRadius = neighborhood.length > 0 ? getMaxNumber(neighborhood) : fallbackRadius;
		return Math.max(radius ?? 0, localRadius * 0.985);
	});

	const outline = dedupePoints(
		smoothedRadii.map((radius, index) => {
			const angle = (index / binCount) * Math.PI * 2;
			return {
				x: center.x + Math.cos(angle) * radius,
				y: center.y + Math.sin(angle) * radius,
			};
		}),
		0.01,
	);

	return outline.length >= 12 ? outline : undefined;
}

function getLargestPlanarBoundaryLoop(
	faces: Array<Array<{ x: number; y: number; z: number }>>,
	precision: number,
): Array<{ x: number; y: number }> | undefined {
	const planeFaces = getTopPlanarFaces(faces);
	if (planeFaces.length < 3) {
		return undefined;
	}

	const pointByKey = new Map<string, { x: number; y: number }>();
	const edgeCounts = new Map<string, { count: number; a: string; b: string }>();

	for (const face of planeFaces) {
		const keys = face.map((point) => {
			const key = pointKey(point, precision);
			if (!pointByKey.has(key)) {
				pointByKey.set(key, point);
			}
			return key;
		}).filter((key, index, allKeys) => index === 0 || key !== allKeys[index - 1]);

		if (keys.length > 2 && keys[0] === keys[keys.length - 1]) {
			keys.pop();
		}
		if (keys.length < 3) {
			continue;
		}

		for (let index = 0; index < keys.length; index += 1) {
			const a = keys[index];
			const b = keys[index === keys.length - 1 ? 0 : index + 1];
			if (a === b) {
				continue;
			}
			const edgeKey = canonicalEdgeKey(a, b);
			const existing = edgeCounts.get(edgeKey);
			edgeCounts.set(edgeKey, {
				count: (existing?.count ?? 0) + 1,
				a,
				b,
			});
		}
	}

	const boundaryEdges = [...edgeCounts.values()].filter(edge => edge.count === 1);
	if (boundaryEdges.length < 3) {
		return undefined;
	}

	const adjacency = new Map<string, Set<string>>();
	for (const edge of boundaryEdges) {
		addAdjacency(adjacency, edge.a, edge.b);
		addAdjacency(adjacency, edge.b, edge.a);
	}

	const unused = new Set(boundaryEdges.map(edge => canonicalEdgeKey(edge.a, edge.b)));
	const loops: Array<Array<{ x: number; y: number }>> = [];

	while (unused.size > 0) {
		const firstEdgeKey = unused.values().next().value as string | undefined;
		if (!firstEdgeKey) {
			break;
		}
		const [start, firstNext] = firstEdgeKey.split('|');
		const loopKeys: Array<string> = [start];
		let previous = start;
		let current = firstNext;
		unused.delete(firstEdgeKey);

		for (let guard = 0; guard < boundaryEdges.length + 5; guard += 1) {
			loopKeys.push(current);
			if (current === start) {
				break;
			}

			const neighbors = [...(adjacency.get(current) ?? [])];
			const next = neighbors.find(neighbor => neighbor !== previous && unused.has(canonicalEdgeKey(current, neighbor)))
				?? neighbors.find(neighbor => unused.has(canonicalEdgeKey(current, neighbor)));
			if (!next) {
				break;
			}

			unused.delete(canonicalEdgeKey(current, next));
			previous = current;
			current = next;
		}

		const loop = removeDuplicateClosingPoint(loopKeys
			.map(key => pointByKey.get(key))
			.filter((point): point is { x: number; y: number } => Boolean(point)));
		if (loop.length >= 3) {
			loops.push(loop);
		}
	}

	const closedLoops = loops
		.map(loop => ({ loop, area: Math.abs(getPolygonSignedArea(loop)) }))
		.filter(entry => entry.area > 0)
		.sort((left, right) => right.area - left.area);

	return closedLoops[0]?.loop;
}

function getTopPlanarFaces(
	faces: Array<Array<{ x: number; y: number; z: number }>>,
): Array<Array<{ x: number; y: number; z: number }>> {
	let maxZ = Number.NEGATIVE_INFINITY;
	for (const face of faces) {
		for (const point of face) {
			if (point.z > maxZ) {
				maxZ = point.z;
			}
		}
	}
	if (!Number.isFinite(maxZ)) {
		return [];
	}

	const topToleranceMm = 0.03;
	return faces.filter(face => face.length >= 3 && face.every(point => point.z >= maxZ - topToleranceMm));
}

function getMaxNumber(values: Array<number>): number {
	let max = Number.NEGATIVE_INFINITY;
	for (const value of values) {
		if (value > max) {
			max = value;
		}
	}
	return max;
}

function pointKey(point: { x: number; y: number }, precision: number): string {
	return `${Math.round(point.x / precision)},${Math.round(point.y / precision)}`;
}

function canonicalEdgeKey(a: string, b: string): string {
	return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function addAdjacency(adjacency: Map<string, Set<string>>, from: string, to: string): void {
	const neighbors = adjacency.get(from) ?? new Set<string>();
	neighbors.add(to);
	adjacency.set(from, neighbors);
}

function objPointToSourcePoint(objX: number, objY: number, objZ: number): { x: number; y: number; z: number } {
	return {
		x: objX * EASYEDA_UNITS_PER_MM,
		y: -objY * EASYEDA_UNITS_PER_MM,
		z: objZ,
	};
}

function dedupePoints(points: Array<{ x: number; y: number }>, precision: number): Array<{ x: number; y: number }> {
	const seen = new Set<string>();
	const unique: Array<{ x: number; y: number }> = [];
	for (const point of points) {
		const key = `${Math.round(point.x / precision)},${Math.round(point.y / precision)}`;
		if (!seen.has(key)) {
			seen.add(key);
			unique.push(point);
		}
	}
	return unique;
}

function getConvexHull(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
	const sorted = [...points].sort((left, right) => left.x - right.x || left.y - right.y);
	if (sorted.length <= 3) {
		return sorted;
	}

	const lower: Array<{ x: number; y: number }> = [];
	for (const point of sorted) {
		while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
			lower.pop();
		}
		lower.push(point);
	}

	const upper: Array<{ x: number; y: number }> = [];
	for (let index = sorted.length - 1; index >= 0; index -= 1) {
		const point = sorted[index];
		while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
			upper.pop();
		}
		upper.push(point);
	}

	lower.pop();
	upper.pop();
	return [...lower, ...upper];
}

function cross(origin: { x: number; y: number }, first: { x: number; y: number }, second: { x: number; y: number }): number {
	return (first.x - origin.x) * (second.y - origin.y) - (first.y - origin.y) * (second.x - origin.x);
}

function keepBaseObjSignalMaterials(objText: string, mtlText: string): BaseObjFilterResult {
	return {
		objText,
		strippedMaterials: parseBlueBaseMaterials(mtlText),
		strippedFaceCount: 0,
	};
}

function getBaseObjBoardBodyMaterials(objText: string, boardClip: BoardOutlineClip): Array<string> {
	const vertices: Array<{ x: number; y: number; z: number } | undefined> = [undefined];
	const materialBounds = new Map<string, {
		left: number;
		right: number;
		top: number;
		bottom: number;
		minZ: number;
		maxZ: number;
		faceCount: number;
	}>();
	let activeMaterial = '';

	for (const line of objText.split(/\r?\n/)) {
		if (line.startsWith('v ')) {
			const [, xText, yText, zText] = line.trim().split(/\s+/);
			vertices.push(objPointToSourcePoint(toNumber(xText), toNumber(yText), toNumber(zText)));
			continue;
		}

		if (line.startsWith('usemtl ')) {
			activeMaterial = line.split(/\s+/, 2)[1] ?? '';
			continue;
		}

		if (!activeMaterial || activeMaterial.startsWith('better_export_') || !line.startsWith('f ')) {
			continue;
		}

		const bounds = materialBounds.get(activeMaterial) ?? {
			left: Number.POSITIVE_INFINITY,
			right: Number.NEGATIVE_INFINITY,
			top: Number.NEGATIVE_INFINITY,
			bottom: Number.POSITIVE_INFINITY,
			minZ: Number.POSITIVE_INFINITY,
			maxZ: Number.NEGATIVE_INFINITY,
			faceCount: 0,
		};

		for (const token of line.trim().split(/\s+/).slice(1)) {
			const vertexIndex = Number.parseInt(token.split('/')[0], 10);
			const vertex = vertices[vertexIndex];
			if (!vertex) {
				continue;
			}

			bounds.left = Math.min(bounds.left, vertex.x);
			bounds.right = Math.max(bounds.right, vertex.x);
			bounds.top = Math.max(bounds.top, vertex.y);
			bounds.bottom = Math.min(bounds.bottom, vertex.y);
			bounds.minZ = Math.min(bounds.minZ, vertex.z);
			bounds.maxZ = Math.max(bounds.maxZ, vertex.z);
		}

		bounds.faceCount += 1;
		materialBounds.set(activeMaterial, bounds);
	}

	const boardArea = Math.max(1, getBoundsArea(boardClip.bounds));
	const materials: Array<string> = [];
	for (const [material, bounds] of materialBounds.entries()) {
		const overlapRatio = getBoundsOverlapArea(bounds, boardClip.bounds) / boardArea;
		const reachesBoardBottom = bounds.minZ <= BOTTOM_BOARD_Z + 0.12;
		const reachesBoardTop = bounds.maxZ >= TOP_BOARD_Z - 0.05;
		const doesNotExtendAboveBoard = bounds.maxZ <= TOP_BOARD_Z + 0.12;
		const hasMeaningfulFaces = bounds.faceCount > 100;
		if (overlapRatio >= 0.75 && reachesBoardBottom && reachesBoardTop && doesNotExtendAboveBoard && hasMeaningfulFaces) {
			materials.push(material);
		}
	}

	if (boardClip.source === 'obj-base-outline') {
		materials.push(boardClip.id);
	}

	return [...new Set(materials)];
}

function stripBaseObjSignalMaterials(objText: string, mtlText: string, extraMaterials: Array<string> = []): BaseObjFilterResult {
	const strippedMaterials = [...new Set([...parseBlueBaseMaterials(mtlText), ...extraMaterials])];
	if (strippedMaterials.length === 0) {
		return { objText, strippedMaterials, strippedFaceCount: 0 };
	}

	const strippedMaterialSet = new Set(strippedMaterials);
	let activeMaterial = '';
	let strippedFaceCount = 0;
	const outputLines: Array<string> = [];

	for (const line of objText.split(/\r?\n/)) {
		if (line.startsWith('usemtl ')) {
			activeMaterial = line.split(/\s+/, 2)[1] ?? '';
			outputLines.push(line);
			continue;
		}

		if (line.startsWith('f ') && strippedMaterialSet.has(activeMaterial)) {
			strippedFaceCount += 1;
			continue;
		}

		outputLines.push(line);
	}

	outputLines.push(`# BetterExport stripped ${strippedFaceCount} base OBJ face(s) from material(s): ${strippedMaterials.join(', ')}`);
	return { objText: outputLines.join('\n'), strippedMaterials, strippedFaceCount };
}

function rewriteBaseSignalMaterialsToEnig(mtlText: string, excludedMaterials: Array<string> = []): MaterialRewriteResult {
	const excludedMaterialSet = new Set(excludedMaterials);
	const recoloredMaterials = parseBlueBaseMaterials(mtlText)
		.filter(material => !excludedMaterialSet.has(material));
	if (recoloredMaterials.length === 0) {
		return { mtlText, recoloredMaterials };
	}

	const recoloredMaterialSet = new Set(recoloredMaterials);
	let activeMaterial = '';
	const outputLines: Array<string> = [];

	for (const line of mtlText.split(/\r?\n/)) {
		if (line.startsWith('newmtl ')) {
			activeMaterial = line.split(/\s+/, 2)[1] ?? '';
			outputLines.push(line);
			continue;
		}

		if (recoloredMaterialSet.has(activeMaterial)) {
			if (line.startsWith('Ka ')) {
				outputLines.push('Ka 1.00 0.82 0.18');
				continue;
			}
			if (line.startsWith('Kd ')) {
				outputLines.push('Kd 1.00 0.72 0.04');
				continue;
			}
			if (line.startsWith('Ks ')) {
				outputLines.push('Ks 1.00 0.92 0.38');
				continue;
			}
			if (line.startsWith('Ns ')) {
				outputLines.push('Ns 220.00');
				continue;
			}
		}

		outputLines.push(line);
	}

	return { mtlText: outputLines.join('\n'), recoloredMaterials };
}

function parseBlueBaseMaterials(mtlText: string): Array<string> {
	const materials: Array<string> = [];
	let activeMaterial = '';

	for (const line of mtlText.split(/\r?\n/)) {
		if (line.startsWith('newmtl ')) {
			activeMaterial = line.split(/\s+/, 2)[1] ?? '';
			continue;
		}

		if (!activeMaterial || activeMaterial.startsWith('better_export_') || !line.startsWith('Kd ')) {
			continue;
		}

		const [, rText, gText, bText] = line.trim().split(/\s+/);
		const r = toNumber(rText);
		const g = toNumber(gText);
		const b = toNumber(bText);
		if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) && isLikelyBlueSignalMaterial(r, g, b)) {
			materials.push(activeMaterial);
		}
	}

	return materials;
}

function isLikelyBlueSignalMaterial(r: number, g: number, b: number): boolean {
	return b >= 0.25 && r <= 0.12 && g <= 0.45 && b > r + 0.18;
}

async function parseEasyEdaDocumentFile(file: File): Promise<{
	imagePrimitives: Array<PcbImagePrimitiveInfo>;
	blobsByHash: Map<string, BlobAsset>;
	boardClip?: BoardOutlineClip;
	boardSlotHoles: Array<Array<{ x: number; y: number }>>;
	generatedPads: Array<GeneratedPad>;
	generatedCopperCircles: Array<GeneratedCopperCircle>;
	warnings: Array<string>;
}> {
	const zip = await JSZip.loadAsync(file);
	const warnings: Array<string> = [];
	const imagePrimitives: Array<PcbImagePrimitiveInfo> = [];
	const blobsByHash = new Map<string, BlobAsset>();
	const componentPlacements: Array<PcbComponentPlacement> = [];
	const standalonePads: Array<GeneratedPad> = [];
	const boardSlotHoles: Array<Array<{ x: number; y: number }>> = [];
	const generatedCopperCircles: Array<GeneratedCopperCircle> = [];
	const boardOutlineCandidates: Array<BoardOutlineCandidate> = [];
	const footprintSourcesById = new Map<string, string>();

	for (const [zipPath, entry] of Object.entries(zip.files)) {
		if (entry.dir || !zipPath.startsWith('PCB/') || !zipPath.endsWith('.epcb')) {
			continue;
		}

		const source = await entry.async('text');
		const sourceImagePrimitives = parseImageObjLines(source);
		for (const primitive of sourceImagePrimitives) {
			imagePrimitives.push({
				...primitive,
				blobHash: primitive.blobReference?.replace(/^blob:/, ''),
				sourceApi: 'document-file',
			});
		}

		const outlineClip = parseBoardOutlineClip(source, zipPath);
		if (outlineClip) {
			boardOutlineCandidates.push(outlineClip);
		}

		if (sourceImagePrimitives.length > 0) {
			componentPlacements.push(...parseComponentPlacements(source));
			standalonePads.push(...parseStandalonePcbPads(source));
			boardSlotHoles.push(...parseBoardSlotRegionHoles(source));
			generatedCopperCircles.push(...parseBottomCopperCircleStrokes(source));
		}
	}

	for (const [zipPath, entry] of Object.entries(zip.files)) {
		if (entry.dir || !zipPath.startsWith('FOOTPRINT/') || !zipPath.endsWith('.efoo')) {
			continue;
		}

		const footprintId = zipPath.replace(/^FOOTPRINT\//, '').replace(/\.efoo$/i, '');
		footprintSourcesById.set(footprintId, await entry.async('text'));
	}

	const generatedPads = [...generatePadsFromFootprints(componentPlacements, footprintSourcesById, warnings), ...standalonePads];
	const boardClip = selectBoardClipForImagePrimitives(boardOutlineCandidates, imagePrimitives, warnings);
	if (boardClip) {
		addBoardSlotHolesToBoardClip(boardClip, boardSlotHoles);
		addGeneratedPadDrillHolesToBoardClip(boardClip, generatedPads);
	}

	for (const [zipPath, entry] of Object.entries(zip.files)) {
		if (entry.dir || !zipPath.startsWith('BLOB/') || !zipPath.endsWith('.eblob')) {
			continue;
		}

		const blobText = await entry.async('text');
		for (const blob of parseBlobFile(blobText, zipPath)) {
			blobsByHash.set(blob.hash, blob);
		}
	}

	for (const primitive of imagePrimitives) {
		if (primitive.blobHash && !blobsByHash.has(primitive.blobHash)) {
			warnings.push(`No BLOB/*.eblob entry matched ${primitive.blobReference} for primitive ${primitive.primitiveId}.`);
		}
	}

	if (boardClip) {
		warnings.push(...boardClip.warnings.map(warning => `Board outline: ${warning}`));
	}
	else if (imagePrimitives.length > 0) {
		warnings.push('No PCB source board outline clip was found; textured OBJ export will try deriving the board outline from EasyEDA base OBJ geometry.');
	}

	if (imagePrimitives.length === 0) {
		warnings.push('No OBJ image primitives were found in PCB/*.epcb files.');
	}

	return { imagePrimitives, blobsByHash, boardClip, boardSlotHoles, generatedPads, generatedCopperCircles, warnings };
}

function parseBlobFile(blobText: string, zipPath: string): Array<BlobAsset> {
	const blobs: Array<BlobAsset> = [];
	for (const line of blobText.split(/\r?\n/)) {
		if (!line.trim()) {
			continue;
		}

		try {
			const row = JSON.parse(line) as Array<unknown>;
			if (row[0] !== 'BLOB' || typeof row[1] !== 'string' || typeof row[2] !== 'string' || typeof row[3] !== 'string') {
				continue;
			}

			const dataUrlMatch = /^data:([^;,]+);base64,(.*)$/s.exec(row[3]);
			if (!dataUrlMatch) {
				continue;
			}

			blobs.push({
				hash: row[1],
				filename: row[2],
				dataUrl: row[3],
				mimeType: dataUrlMatch[1],
				sizeBytes: estimateBase64ByteLength(dataUrlMatch[2]),
				zipPath,
			});
		}
		catch {
			// Ignore non-JSON or unrelated rows.
		}
	}

	return blobs;
}

async function saveRecoveredPngs(
	imagePrimitives: Array<PcbImagePrimitiveInfo>,
	blobsByHash: Map<string, BlobAsset>,
	timestamp: string,
): Promise<Array<{ hash: string; saved: boolean; fileName?: string; error?: string }>> {
	const uniqueHashes = [...new Set(imagePrimitives.map(primitive => primitive.blobHash).filter((hash): hash is string => Boolean(hash)))];
	const results: Array<{ hash: string; saved: boolean; fileName?: string; error?: string }> = [];

	for (const hash of uniqueHashes) {
		const blobAsset = blobsByHash.get(hash);
		if (!blobAsset) {
			results.push({ hash, saved: false, error: 'No matching BLOB asset was found in the document file.' });
			continue;
		}

		const fileName = `${EXPORT_BASENAME}-${timestamp}-${sanitizeFileNamePart(blobAsset.filename)}`;
		try {
			await eda.sys_FileSystem.saveFile(dataUrlToBlob(blobAsset.dataUrl), fileName);
			results.push({ hash, saved: true, fileName });
		}
		catch (error) {
			results.push({ hash, saved: false, fileName, error: getErrorMessage(error) });
		}
	}

	return results;
}

function dataUrlToBlob(dataUrl: string): Blob {
	const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
	if (!match) {
		throw new Error('Unsupported BLOB data URL format.');
	}

	const byteString = atob(match[2]);
	const bytes = new Uint8Array(byteString.length);
	for (let index = 0; index < byteString.length; index += 1) {
		bytes[index] = byteString.charCodeAt(index);
	}

	return new Blob([bytes], { type: match[1] });
}

function estimateBase64ByteLength(base64: string): number {
	const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
	return Math.floor((base64.length * 3) / 4) - padding;
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
	const match = /^data:[^;,]+;base64,(.*)$/s.exec(dataUrl);
	if (!match) {
		throw new Error('Unsupported BLOB data URL format.');
	}

	const byteString = atob(match[1]);
	const bytes = new Uint8Array(byteString.length);
	for (let index = 0; index < byteString.length; index += 1) {
		bytes[index] = byteString.charCodeAt(index);
	}

	return bytes;
}

function collectTextureAssets(
	imagePrimitives: Array<PcbImagePrimitiveInfo>,
	blobsByHash: Map<string, BlobAsset>,
	timestamp: string,
): Array<{ hash: string; path: string; fileName: string; blob: BlobAsset }> {
	const assets: Array<{ hash: string; path: string; fileName: string; blob: BlobAsset }> = [];
	const usedHashes = new Set<string>();

	for (const primitive of imagePrimitives) {
		if (!primitive.blobHash || usedHashes.has(primitive.blobHash)) {
			continue;
		}

		const blob = blobsByHash.get(primitive.blobHash);
		if (!blob) {
			continue;
		}

		const fileName = `${sanitizeFileNamePart(timestamp)}-${sanitizeFileNamePart(blob.filename)}`;
		usedHashes.add(primitive.blobHash);
		assets.push({
			hash: primitive.blobHash,
			path: `textures/${fileName}`,
			fileName,
			blob,
		});
	}

	return assets;
}

function bakeImageQuadsIntoObj(
	objText: string,
	mtlText: string,
	imagePrimitives: Array<PcbImagePrimitiveInfo>,
	textureAssets: Array<{ hash: string; path: string; fileName: string; blob: BlobAsset }>,
	boardClip?: BoardOutlineClip,
	generatedPads: Array<GeneratedPad> = [],
	generatedCopperCircles: Array<GeneratedCopperCircle> = [],
): { objText: string; mtlText: string } {
	let nextVertexIndex = countObjRecords(objText, 'v') + 1;
	let nextTextureIndex = countObjRecords(objText, 'vt') + 1;
	let nextNormalIndex = countObjRecords(objText, 'vn') + 1;
	const objLines: Array<string> = [
		'',
		'# BetterExport textured image primitive quads',
	];
	const mtlLines: Array<string> = [
		mtlText.trimEnd(),
		'',
		'# BetterExport image primitive texture materials',
	];
	const boardTextureBindings = boardClip
		? getBoardTextureBindings(imagePrimitives, textureAssets, boardClip)
		: [];
	const bakedPrimitiveIds = new Set(boardTextureBindings.map(binding => binding.primitive.primitiveId));

	if (boardClip) {
		mtlLines.push(
			'',
			'# BetterExport generated PCB body material',
			'newmtl better_export_board_body',
			'Ka 0.00 0.35 0.08',
			'Kd 0.00 0.42 0.10',
			'Ks 0.08 0.08 0.08',
			'Ns 80.00',
			'd 1.00',
			'illum 2',
			'endmtl',
		);

		for (const binding of boardTextureBindings) {
			mtlLines.push(
				'',
				`# BetterExport baked PCB ${binding.isBottom ? 'bottom' : 'top'} texture material`,
				`newmtl ${binding.materialName}`,
				'Ka 1.00 1.00 1.00',
				'Kd 1.00 1.00 1.00',
				'Ks 0.00 0.00 0.00',
				'Ns 10.00',
				'd 1.00',
				'Tr 0.00',
				'illum 2',
				`map_Ka ${binding.textureAsset.fileName}`,
				`map_Kd ${binding.textureAsset.fileName}`,
				'endmtl',
			);
		}

		const vertexIndex = nextVertexIndex;
		const textureIndex = nextTextureIndex;
		const normalIndex = nextNormalIndex;
		const topBinding = boardTextureBindings.find(binding => !binding.isBottom);
		const bottomBinding = boardTextureBindings.find(binding => binding.isBottom);
		const mesh = getGeneratedBoardObjMesh(boardClip, topBinding?.primitive, bottomBinding?.primitive);
		objLines.push(
			'',
			'# BetterExport generated PCB body mesh',
			`# board_body source=${boardClip.source} outer_points=${boardClip.points.length} hole_count=${boardClip.holes.length} baked_texture_count=${boardTextureBindings.length}`,
			...mesh.vertices.map(vertex => `v ${formatNumber(vertex.x)} ${formatNumber(vertex.y)} ${formatNumber(vertex.z)}`),
			...mesh.topUvs.map(uv => `vt ${formatNumber(uv.u)} ${formatNumber(uv.v)}`),
			...mesh.bottomUvs.map(uv => `vt ${formatNumber(uv.u)} ${formatNumber(uv.v)}`),
			'vn 0 0 1',
			'vn 0 0 -1',
		);
		if (topBinding) {
			objLines.push(`usemtl ${topBinding.materialName}`);
			for (const face of mesh.topFaces) {
				objLines.push(`f ${face.map(index => `${vertexIndex + index}/${textureIndex + index}/${normalIndex}`).join(' ')}`);
			}
		}
		else {
			objLines.push('usemtl better_export_board_body');
			for (const face of mesh.topFaces) {
				objLines.push(`f ${face.map(index => `${vertexIndex + index}//${normalIndex}`).join(' ')}`);
			}
		}
		if (bottomBinding) {
			objLines.push(`usemtl ${bottomBinding.materialName}`);
			const bottomTextureOffset = textureIndex + mesh.topUvs.length;
			const bottomNormalIndex = normalIndex + 1;
			const bottomVertexOffset = mesh.topUvs.length;
			for (const face of mesh.bottomFaces) {
				objLines.push(`f ${face.map(index => `${vertexIndex + index}/${bottomTextureOffset + index - bottomVertexOffset}/${bottomNormalIndex}`).join(' ')}`);
			}
		}
		else {
			objLines.push('usemtl better_export_board_body');
			for (const face of mesh.bottomFaces) {
				objLines.push(`f ${face.map(index => `${vertexIndex + index}//${normalIndex + 1}`).join(' ')}`);
			}
		}
		objLines.push('usemtl better_export_board_body');
		for (const face of mesh.wallFaces) {
			objLines.push(`f ${face.map(index => String(vertexIndex + index)).join(' ')}`);
		}
		nextVertexIndex += mesh.vertices.length;
		nextTextureIndex += mesh.topUvs.length + mesh.bottomUvs.length;
		nextNormalIndex += 2;
	}

	const textureClip = boardClip ? getTextureBoardClip(boardClip) : undefined;

	if (generatedPads.length > 0 || generatedCopperCircles.length > 0) {
		mtlLines.push(
			'',
			'# BetterExport generated ENIG copper material',
			'newmtl better_export_enig_copper',
			'Ka 1.00 0.86 0.25',
			'Kd 1.00 0.78 0.05',
			'Ks 1.00 0.92 0.45',
			'Ns 180.00',
			'd 1.00',
			'illum 2',
			'endmtl',
		);

		objLines.push(
			'',
			'# BetterExport generated ENIG copper meshes',
			'usemtl better_export_enig_copper',
			'vn 0 0 1',
			'vn 0 0 -1',
		);

		const padNormalIndex = nextNormalIndex;
		const bottomCopperNormalIndex = nextNormalIndex + 1;
		nextNormalIndex += 2;
		for (const pad of generatedPads) {
			const vertexIndex = nextVertexIndex;
			const mesh = getGeneratedPadObjMesh(pad);
			const isBottomPad = pad.layer === 2;
			const normalIndex = isBottomPad ? bottomCopperNormalIndex : padNormalIndex;
			objLines.push(
				`# pad component=${pad.componentId} footprint=${pad.footprintId} number=${pad.number} component_layer=${pad.componentLayer} layer=${pad.layer} transform=${pad.transform}`,
				...mesh.vertices.map(corner => `v ${formatNumber(corner.x)} ${formatNumber(corner.y)} ${formatNumber(corner.z)}`),
			);
			for (const face of mesh.faces) {
				const indices = isBottomPad ? [...face].reverse() : face;
				objLines.push(`f ${indices.map(index => `${vertexIndex + index}//${normalIndex}`).join(' ')}`);
			}
			nextVertexIndex += mesh.vertices.length;
		}

		for (const circle of generatedCopperCircles) {
			const vertexIndex = nextVertexIndex;
			const mesh = getGeneratedCopperCircleMesh(circle);
			objLines.push(
				`# bottom_copper_circle primitive=${circle.primitiveId} net=${circle.net || '(none)'} layer=${circle.layer} center_x=${formatNumber(circle.centerX)} center_y=${formatNumber(circle.centerY)} radius=${formatNumber(circle.radius)} width=${formatNumber(circle.width)}`,
				...mesh.vertices.map(vertex => `v ${formatNumber(vertex.x)} ${formatNumber(vertex.y)} ${formatNumber(vertex.z)}`),
			);
			for (const face of mesh.faces) {
				objLines.push(`f ${face.map(index => `${vertexIndex + index}//${bottomCopperNormalIndex}`).join(' ')}`);
			}
			nextVertexIndex += mesh.vertices.length;
		}
	}

	for (const primitive of imagePrimitives) {
		if (!primitive.blobHash) {
			continue;
		}
		if (bakedPrimitiveIds.has(primitive.primitiveId)) {
			continue;
		}

		const textureAsset = textureAssets.find(asset => asset.hash === primitive.blobHash);
		if (!textureAsset) {
			continue;
		}

		const materialName = `better_export_${sanitizeMaterialName(primitive.primitiveId)}`;
		const normalIndex = nextNormalIndex;
		const vertexIndex = nextVertexIndex;
		const textureIndex = nextTextureIndex;
		const isBottom = primitive.layer === 4;

		mtlLines.push(
			`newmtl ${materialName}`,
			'Ka 1.00 1.00 1.00',
			'Kd 1.00 1.00 1.00',
			'Ks 0.00 0.00 0.00',
			'Ns 10.00',
			'd 1.00',
			'Tr 0.00',
			'illum 2',
			`map_Ka ${textureAsset.fileName}`,
			`map_Kd ${textureAsset.fileName}`,
			'endmtl',
		);

		const mesh = getPrimitiveImageMesh(primitive, isBottom ? BOTTOM_TEXTURE_Z : TOP_TEXTURE_Z, isBottom, textureClip);
		objLines.push(
			`o better_export_image_${primitive.primitiveId}`,
			`# source_layer=${primitive.layer} source_x=${formatNumber(primitive.x)} source_y=${formatNumber(primitive.y)} source_width=${formatNumber(primitive.width)} source_height=${formatNumber(primitive.height)}`,
			mesh.comment,
			`usemtl ${materialName}`,
			...mesh.vertices.map(vertex => `v ${formatNumber(vertex.x)} ${formatNumber(vertex.y)} ${formatNumber(vertex.z)}`),
			...mesh.uvs.map(uv => `vt ${formatNumber(uv.u)} ${formatNumber(uv.v)}`),
			isBottom ? 'vn 0 0 -1' : 'vn 0 0 1',
		);

		for (const face of mesh.faces) {
			objLines.push(`f ${face.map(index => `${vertexIndex + index}/${textureIndex + index}/${normalIndex}`).join(' ')}`);
		}

		nextVertexIndex += mesh.vertices.length;
		nextTextureIndex += mesh.uvs.length;
		nextNormalIndex += 1;
	}

	return {
		objText: forceSingleObjObject(`${objText.trimEnd()}\n${objLines.join('\n')}\n`),
		mtlText: `${mtlLines.join('\n')}\n`,
	};
}

function forceSingleObjObject(objText: string): string {
	const lines = objText.split(/\r?\n/).filter(line => !/^(?:o|g)\s+/.test(line));
	const mtllibIndex = lines.findIndex(line => line.startsWith('mtllib '));
	const insertIndex = mtllibIndex >= 0 ? mtllibIndex + 1 : 1;
	lines.splice(insertIndex, 0, 'o better_export_pcb');
	return `${lines.join('\n').replace(/\n+$/g, '')}\n`;
}

function countObjRecords(objText: string, recordType: 'v' | 'vt' | 'vn'): number {
	const prefix = `${recordType} `;
	return objText.split(/\r?\n/).filter(line => line.startsWith(prefix)).length;
}

function getBoardTextureBindings(
	imagePrimitives: Array<PcbImagePrimitiveInfo>,
	textureAssets: Array<{ hash: string; path: string; fileName: string; blob: BlobAsset }>,
	boardClip: BoardOutlineClip,
): Array<BoardTextureBinding> {
	const bindings: Array<BoardTextureBinding> = [];
	const top = selectBoardTexturePrimitive(imagePrimitives, textureAssets, boardClip, false);
	const bottom = selectBoardTexturePrimitive(imagePrimitives, textureAssets, boardClip, true);

	if (top) {
		bindings.push({
			...top,
			materialName: 'better_export_board_top_texture',
			isBottom: false,
		});
	}

	if (bottom) {
		bindings.push({
			...bottom,
			materialName: 'better_export_board_bottom_texture',
			isBottom: true,
		});
	}

	return bindings;
}

function selectBoardTexturePrimitive(
	imagePrimitives: Array<PcbImagePrimitiveInfo>,
	textureAssets: Array<{ hash: string; path: string; fileName: string; blob: BlobAsset }>,
	boardClip: BoardOutlineClip,
	isBottom: boolean,
): Pick<BoardTextureBinding, 'primitive' | 'textureAsset'> | undefined {
	const layer = isBottom ? 4 : 3;
	let best: Pick<BoardTextureBinding, 'primitive' | 'textureAsset'> | undefined;
	let bestScore = 0;

	for (const primitive of imagePrimitives) {
		if (primitive.layer !== layer || !primitive.blobHash) {
			continue;
		}

		const textureAsset = textureAssets.find(asset => asset.hash === primitive.blobHash);
		if (!textureAsset) {
			continue;
		}

		const sourceBox = getPrimitiveSourceBox(primitive);
		const sourceArea = getBoundsArea(sourceBox);
		if (sourceArea <= 0) {
			continue;
		}

		const overlapArea = getBoundsOverlapArea(sourceBox, boardClip.bounds);
		const overlapRatio = overlapArea / Math.max(1, boardClip.area);
		const primitiveCoverage = overlapArea / sourceArea;
		const score = overlapRatio * 2 + primitiveCoverage;
		if (score > bestScore && primitiveOverlapsClip(sourceBox, boardClip)) {
			best = { primitive, textureAsset };
			bestScore = score;
		}
	}

	return best;
}

function getGeneratedBoardObjMesh(
	boardClip: BoardOutlineClip,
	topTexturePrimitive?: PcbImagePrimitiveInfo,
	bottomTexturePrimitive?: PcbImagePrimitiveInfo,
): {
	vertices: Array<{ x: number; y: number; z: number }>;
	topUvs: Array<{ u: number; v: number }>;
	bottomUvs: Array<{ u: number; v: number }>;
	topFaces: Array<Array<number>>;
	bottomFaces: Array<Array<number>>;
	wallFaces: Array<Array<number>>;
} {
	const outer = normalizePolygonWinding(removeDuplicateClosingPoint(boardClip.points), false);
	const holes = boardClip.holes
		.map(hole => normalizePolygonWinding(removeDuplicateClosingPoint(hole), true))
		.filter(hole => hole.length >= 3);
	const allTopSourcePoints = [outer, ...holes].flat();
	const holeIndices: Array<number> = [];
	let nextHoleIndex = outer.length;
	for (const hole of holes) {
		holeIndices.push(nextHoleIndex);
		nextHoleIndex += hole.length;
	}

	const vertices: Array<{ x: number; y: number; z: number }> = [];
	for (const point of allTopSourcePoints) {
		vertices.push(sourcePointToObjPoint(point.x, point.y, TOP_BOARD_Z));
	}
	for (const point of allTopSourcePoints) {
		vertices.push(sourcePointToObjPoint(point.x, point.y, BOTTOM_BOARD_Z));
	}
	const topUvs = allTopSourcePoints.map(point => topTexturePrimitive
		? sourcePointToPrimitiveUv(point.x, point.y, topTexturePrimitive, false)
		: { u: 0, v: 0 });
	const bottomUvs = allTopSourcePoints.map(point => bottomTexturePrimitive
		? sourcePointToPrimitiveUv(point.x, point.y, bottomTexturePrimitive, true)
		: { u: 0, v: 0 });

	const flatCoordinates = allTopSourcePoints.flatMap(point => [point.x, point.y]);
	const triangleIndices = earcut(flatCoordinates, holeIndices);
	const topFaces: Array<Array<number>> = [];
	const bottomFaces: Array<Array<number>> = [];
	const wallFaces: Array<Array<number>> = [];
	const bottomOffset = allTopSourcePoints.length;
	for (let index = 0; index < triangleIndices.length; index += 3) {
		const first = triangleIndices[index];
		const second = triangleIndices[index + 1];
		const third = triangleIndices[index + 2];
		topFaces.push([first, second, third]);
		bottomFaces.push([bottomOffset + first, bottomOffset + third, bottomOffset + second]);
	}

	let loopStart = 0;
	addGeneratedBoardWallFaces(wallFaces, loopStart, outer.length, bottomOffset, false);
	loopStart += outer.length;
	for (const hole of holes) {
		addGeneratedBoardWallFaces(wallFaces, loopStart, hole.length, bottomOffset, true);
		loopStart += hole.length;
	}

	return { vertices, topUvs, bottomUvs, topFaces, bottomFaces, wallFaces };
}

function getTextureBoardClip(boardClip: BoardOutlineClip): BoardOutlineClip {
	const points = offsetPolygonFromCentroid(boardClip.points, -TEXTURE_EDGE_INSET_SOURCE_UNITS);
	const holes = boardClip.holes
		.map(hole => offsetPolygonFromCentroid(hole, TEXTURE_EDGE_INSET_SOURCE_UNITS))
		.filter(hole => hole.length >= 3);

	return {
		...boardClip,
		id: `${boardClip.id}-texture-inset`,
		points,
		holes,
		bounds: getPointBounds(points),
		area: Math.abs(getPolygonSignedArea(points)),
		warnings: [
			...boardClip.warnings,
			`Inset image clip by ${formatNumber(TEXTURE_EDGE_INSET_SOURCE_UNITS / EASYEDA_UNITS_PER_MM)}mm to reduce edge z-fighting.`,
		],
	};
}

function offsetPolygonFromCentroid(points: Array<{ x: number; y: number }>, offset: number): Array<{ x: number; y: number }> {
	const polygon = removeDuplicateClosingPoint(points);
	if (polygon.length < 3 || offset === 0) {
		return polygon;
	}

	const centroid = getPolygonCentroid(polygon);
	return polygon.map((point) => {
		const dx = point.x - centroid.x;
		const dy = point.y - centroid.y;
		const length = Math.hypot(dx, dy);
		if (length <= 0.0001) {
			return point;
		}

		const scaledLength = Math.max(0, length + offset);
		const scale = scaledLength / length;
		return {
			x: centroid.x + dx * scale,
			y: centroid.y + dy * scale,
		};
	});
}

function getPolygonCentroid(points: Array<{ x: number; y: number }>): { x: number; y: number } {
	const polygon = removeDuplicateClosingPoint(points);
	const signedArea = getPolygonSignedArea(polygon);
	if (Math.abs(signedArea) <= 0.0001) {
		return getAveragePoint(polygon);
	}

	let x = 0;
	let y = 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const point = polygon[index];
		const next = polygon[index === polygon.length - 1 ? 0 : index + 1];
		const cross = point.x * next.y - next.x * point.y;
		x += (point.x + next.x) * cross;
		y += (point.y + next.y) * cross;
	}

	const factor = 1 / (6 * signedArea);
	return { x: x * factor, y: y * factor };
}

function getAveragePoint(points: Array<{ x: number; y: number }>): { x: number; y: number } {
	const total = points.reduce((sum, point) => ({
		x: sum.x + point.x,
		y: sum.y + point.y,
	}), { x: 0, y: 0 });

	return points.length > 0
		? { x: total.x / points.length, y: total.y / points.length }
		: { x: 0, y: 0 };
}

function addGeneratedBoardWallFaces(
	faces: Array<Array<number>>,
	loopStart: number,
	loopLength: number,
	bottomOffset: number,
	isHole: boolean,
): void {
	for (let index = 0; index < loopLength; index += 1) {
		const next = index === loopLength - 1 ? 0 : index + 1;
		const topA = loopStart + index;
		const topB = loopStart + next;
		const bottomA = bottomOffset + topA;
		const bottomB = bottomOffset + topB;
		if (isHole) {
			faces.push([topA, bottomA, bottomB]);
			faces.push([topA, bottomB, topB]);
		}
		else {
			faces.push([topA, topB, bottomB]);
			faces.push([topA, bottomB, bottomA]);
		}
	}
}

function getGeneratedPadObjMesh(pad: GeneratedPad): {
	vertices: Array<{ x: number; y: number; z: number }>;
	faces: Array<Array<number>>;
} {
	const outer = normalizePolygonWinding(getGeneratedPadOuterPolygon(pad), false);
	const hole = getGeneratedPadHolePolygon(pad);
	const holes = hole.length >= 3 ? [normalizePolygonWinding(hole, true)] : [];
	const allPoints = [outer, ...holes].flat();
	const holeIndices = holes.length > 0 ? [outer.length] : [];
	const flatCoordinates = allPoints.flatMap(point => [point.x, point.y]);
	const triangleIndices = earcut(flatCoordinates, holeIndices);
	const z = pad.layer === 2 ? BOTTOM_PAD_Z : TOP_PAD_Z;
	const vertices = allPoints.map(point => sourcePointToObjPoint(point.x, point.y, z));
	const faces: Array<Array<number>> = [];

	for (let index = 0; index < triangleIndices.length; index += 3) {
		faces.push([
			triangleIndices[index],
			triangleIndices[index + 1],
			triangleIndices[index + 2],
		]);
	}

	return { vertices, faces };
}

function getGeneratedPadOuterPolygon(pad: GeneratedPad): Array<{ x: number; y: number }> {
	if (pad.shape === 'ellipse') {
		return getGeneratedPadEllipsePolygon(pad, pad.width, pad.height);
	}

	if (pad.shape === 'oval') {
		return getGeneratedPadOvalPolygon(pad, pad.width, pad.height);
	}

	const halfWidth = pad.width / 2;
	const halfHeight = pad.height / 2;
	const localCorners = [
		{ x: -halfWidth, y: halfHeight },
		{ x: halfWidth, y: halfHeight },
		{ x: halfWidth, y: -halfHeight },
		{ x: -halfWidth, y: -halfHeight },
	];

	return localCorners.map((corner) => {
		const rotated = rotatePoint(corner.x, corner.y, 0, 0, pad.rotation);
		return { x: pad.x + rotated.x, y: pad.y + rotated.y };
	});
}

function getGeneratedPadHolePolygon(pad: GeneratedPad): Array<{ x: number; y: number }> {
	if (!pad.drill) {
		return [];
	}

	if (pad.drill.shape === 'slot') {
		return getGeneratedPadOvalPolygon(pad, pad.drill.width, pad.drill.height);
	}

	return getGeneratedPadEllipsePolygon(pad, pad.drill.width, pad.drill.height);
}

function getGeneratedPadEllipsePolygon(pad: GeneratedPad, width: number, height: number): Array<{ x: number; y: number }> {
	const points: Array<{ x: number; y: number }> = [];
	const halfWidth = width / 2;
	const halfHeight = height / 2;
	for (let index = 0; index < PAD_CURVE_SEGMENTS; index += 1) {
		const angle = (Math.PI * 2 * index) / PAD_CURVE_SEGMENTS;
		const rotated = rotatePoint(Math.cos(angle) * halfWidth, Math.sin(angle) * halfHeight, 0, 0, pad.rotation);
		points.push({ x: pad.x + rotated.x, y: pad.y + rotated.y });
	}
	return points;
}

function getGeneratedPadOvalPolygon(pad: GeneratedPad, width: number, height: number): Array<{ x: number; y: number }> {
	if (Math.abs(width - height) <= 0.01) {
		return getGeneratedPadEllipsePolygon(pad, width, height);
	}

	const points: Array<{ x: number; y: number }> = [];
	const radius = Math.min(width, height) / 2;
	const horizontal = width >= height;
	const straightHalf = Math.abs(width - height) / 2;
	const steps = Math.max(12, Math.floor(PAD_CURVE_SEGMENTS / 2));

	for (let index = 0; index <= steps; index += 1) {
		const angle = horizontal
			? -Math.PI / 2 + (Math.PI * index) / steps
			: (Math.PI * index) / steps;
		const center = horizontal ? { x: straightHalf, y: 0 } : { x: 0, y: straightHalf };
		const local = { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
		const rotated = rotatePoint(local.x, local.y, 0, 0, pad.rotation);
		points.push({ x: pad.x + rotated.x, y: pad.y + rotated.y });
	}

	for (let index = 0; index <= steps; index += 1) {
		const angle = horizontal
			? Math.PI / 2 + (Math.PI * index) / steps
			: Math.PI + (Math.PI * index) / steps;
		const center = horizontal ? { x: -straightHalf, y: 0 } : { x: 0, y: -straightHalf };
		const local = { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
		const rotated = rotatePoint(local.x, local.y, 0, 0, pad.rotation);
		points.push({ x: pad.x + rotated.x, y: pad.y + rotated.y });
	}

	return removeDuplicateClosingPoint(points);
}

function getGeneratedCopperCircleMesh(circle: GeneratedCopperCircle): {
	vertices: Array<{ x: number; y: number; z: number }>;
	faces: Array<Array<number>>;
} {
	const vertices: Array<{ x: number; y: number; z: number }> = [];
	const faces: Array<Array<number>> = [];
	const outerRadius = circle.radius + circle.width / 2;
	const innerRadius = Math.max(0, circle.radius - circle.width / 2);

	if (outerRadius <= 0) {
		return { vertices, faces };
	}

	if (innerRadius === 0) {
		vertices.push(sourcePointToObjPoint(circle.centerX, circle.centerY, BOTTOM_COPPER_Z));
		for (let index = 0; index < COPPER_CIRCLE_SEGMENTS; index += 1) {
			const angle = (Math.PI * 2 * index) / COPPER_CIRCLE_SEGMENTS;
			vertices.push(sourcePointToObjPoint(
				circle.centerX + Math.cos(angle) * outerRadius,
				circle.centerY + Math.sin(angle) * outerRadius,
				BOTTOM_COPPER_Z,
			));
		}

		for (let index = 1; index <= COPPER_CIRCLE_SEGMENTS; index += 1) {
			const next = index === COPPER_CIRCLE_SEGMENTS ? 1 : index + 1;
			faces.push([0, next, index]);
		}

		return { vertices, faces };
	}

	for (let index = 0; index < COPPER_CIRCLE_SEGMENTS; index += 1) {
		const angle = (Math.PI * 2 * index) / COPPER_CIRCLE_SEGMENTS;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		vertices.push(sourcePointToObjPoint(circle.centerX + cos * outerRadius, circle.centerY + sin * outerRadius, BOTTOM_COPPER_Z));
		vertices.push(sourcePointToObjPoint(circle.centerX + cos * innerRadius, circle.centerY + sin * innerRadius, BOTTOM_COPPER_Z));
	}

	for (let index = 0; index < COPPER_CIRCLE_SEGMENTS; index += 1) {
		const outer = index * 2;
		const inner = outer + 1;
		const nextOuter = index === COPPER_CIRCLE_SEGMENTS - 1 ? 0 : outer + 2;
		const nextInner = index === COPPER_CIRCLE_SEGMENTS - 1 ? 1 : inner + 2;
		faces.push([outer, nextOuter, inner]);
		faces.push([inner, nextOuter, nextInner]);
	}

	return { vertices, faces };
}

function getPrimitiveObjCorners(primitive: PcbImagePrimitiveInfo, z: number): Array<{ x: number; y: number; z: number }> {
	return getPrimitiveSourceCorners(primitive).map(point => sourcePointToObjPoint(point.x, point.y, z));
}

function getPrimitiveImageMesh(
	primitive: PcbImagePrimitiveInfo,
	z: number,
	isBottom: boolean,
	boardClip?: BoardOutlineClip,
): {
	comment: string;
	vertices: Array<{ x: number; y: number; z: number }>;
	uvs: Array<{ u: number; v: number }>;
	faces: Array<Array<number>>;
} {
	const sourceBox = getPrimitiveSourceBox(primitive);
	if (boardClip && primitiveOverlapsClip(sourceBox, boardClip)) {
		return getOutlineClippedPrimitiveMesh(primitive, z, isBottom, boardClip);
	}

	return {
		comment: '# clip=none shape=quad',
		vertices: getPrimitiveObjCorners(primitive, z),
		uvs: getPrimitiveUvs(primitive, isBottom),
		faces: isBottom ? [[0, 2, 1], [0, 3, 2]] : [[0, 1, 2], [0, 2, 3]],
	};
}

function getOutlineClippedPrimitiveMesh(
	primitive: PcbImagePrimitiveInfo,
	z: number,
	isBottom: boolean,
	clip: BoardOutlineClip,
): {
	comment: string;
	vertices: Array<{ x: number; y: number; z: number }>;
	uvs: Array<{ u: number; v: number }>;
	faces: Array<Array<number>>;
} {
	const vertices: Array<{ x: number; y: number; z: number }> = [];
	const uvs: Array<{ u: number; v: number }> = [];
	const faces: Array<Array<number>> = [];
	const polygonPoints = normalizePolygonWinding(removeDuplicateClosingPoint(clip.points), isBottom);
	const holePoints = clip.holes
		.map(hole => normalizePolygonWinding(removeDuplicateClosingPoint(hole), !isBottom))
		.filter(hole => hole.length >= 3);
	const allPoints = [polygonPoints, ...holePoints].flat();
	const holeIndices: Array<number> = [];
	let nextHoleIndex = polygonPoints.length;
	for (const hole of holePoints) {
		holeIndices.push(nextHoleIndex);
		nextHoleIndex += hole.length;
	}
	const flatCoordinates = allPoints.flatMap(point => [point.x, point.y]);
	const triangleIndices = earcut(flatCoordinates, holeIndices);

	for (const point of allPoints) {
		vertices.push(sourcePointToObjPoint(point.x, point.y, z));
		uvs.push(sourcePointToPrimitiveUv(point.x, point.y, primitive, isBottom));
	}

	for (let index = 0; index < triangleIndices.length; index += 3) {
		faces.push([
			triangleIndices[index],
			triangleIndices[index + 1],
			triangleIndices[index + 2],
		]);
	}

	return {
		comment: `# clip=${clip.source} point_count=${polygonPoints.length} hole_count=${holePoints.length} triangle_count=${faces.length}`,
		vertices,
		uvs,
		faces,
	};
}

function getPrimitiveSourceBox(primitive: PcbImagePrimitiveInfo): { left: number; right: number; top: number; bottom: number; centerX: number; centerY: number } {
	const isBottom = primitive.layer === 4;
	const left = isBottom ? primitive.x - primitive.width : primitive.x;
	const top = primitive.y;
	const right = isBottom ? primitive.x : primitive.x + primitive.width;
	const bottom = primitive.y - primitive.height;
	const centerX = (left + right) / 2;
	const centerY = primitive.y - primitive.height / 2;
	return { left, right, top, bottom, centerX, centerY };
}

function getPrimitiveSourceCorners(primitive: PcbImagePrimitiveInfo): Array<{ x: number; y: number }> {
	const sourceBox = getPrimitiveSourceBox(primitive);
	return [
		{ x: sourceBox.left, y: sourceBox.top },
		{ x: sourceBox.right, y: sourceBox.top },
		{ x: sourceBox.right, y: sourceBox.bottom },
		{ x: sourceBox.left, y: sourceBox.bottom },
	].map(point => rotatePoint(point.x, point.y, sourceBox.centerX, sourceBox.centerY, primitive.rotation));
}

function primitiveContainsClip(
	sourceBox: { left: number; right: number; top: number; bottom: number },
	clip: BoardOutlineClip,
): boolean {
	const tolerance = 1;
	return clip.bounds.left >= sourceBox.left - tolerance
		&& clip.bounds.right <= sourceBox.right + tolerance
		&& clip.bounds.top <= sourceBox.top + tolerance
		&& clip.bounds.bottom >= sourceBox.bottom - tolerance;
}

function primitiveOverlapsClip(
	sourceBox: { left: number; right: number; top: number; bottom: number },
	clip: BoardOutlineClip,
): boolean {
	const sourceArea = getBoundsArea(sourceBox);
	return sourceArea > 0 && getBoundsOverlapArea(sourceBox, clip.bounds) / sourceArea > 0.05;
}

function addBoardSlotHolesToBoardClip(boardClip: BoardOutlineClip, boardSlotHoles: Array<Array<{ x: number; y: number }>>): void {
	const holes = boardSlotHoles
		.map(removeDuplicateClosingPoint)
		.filter(hole => hole.length >= 3 && pointInPolygon(hole[0], boardClip.points));

	if (holes.length === 0) {
		return;
	}

	boardClip.holes.push(...holes);
	boardClip.warnings.push(`Added ${holes.length} board slot/cutout region(s) to the image clip.`);
}

function addGeneratedPadDrillHolesToBoardClip(boardClip: BoardOutlineClip, generatedPads: Array<GeneratedPad>): void {
	const drillHoles = generatedPads
		.filter(pad => pad.layer === 1 && pad.drill)
		.map(pad => getGeneratedPadHolePolygon(pad))
		.filter(hole => hole.length >= 3);

	if (drillHoles.length === 0) {
		return;
	}

	boardClip.holes.push(...drillHoles);
	boardClip.warnings.push(`Added ${drillHoles.length} plated through-hole drill/slot cutout(s) to the image clip.`);
}

function getBoundsArea(bounds: { left: number; right: number; top: number; bottom: number }): number {
	return Math.max(0, bounds.right - bounds.left) * Math.max(0, bounds.top - bounds.bottom);
}

function getBoundsOverlapArea(
	first: { left: number; right: number; top: number; bottom: number },
	second: { left: number; right: number; top: number; bottom: number },
): number {
	const left = Math.max(first.left, second.left);
	const right = Math.min(first.right, second.right);
	const bottom = Math.max(first.bottom, second.bottom);
	const top = Math.min(first.top, second.top);
	return Math.max(0, right - left) * Math.max(0, top - bottom);
}

function getPolygonSignedArea(points: Array<{ x: number; y: number }>): number {
	let area = 0;
	for (let index = 0; index < points.length; index += 1) {
		const point = points[index];
		const next = points[index === points.length - 1 ? 0 : index + 1];
		area += point.x * next.y - next.x * point.y;
	}
	return area / 2;
}

function normalizePolygonWinding(points: Array<{ x: number; y: number }>, isBottom: boolean): Array<{ x: number; y: number }> {
	const area = getPolygonSignedArea(points);
	const shouldReverse = isBottom ? area > 0 : area < 0;
	return shouldReverse ? [...points].reverse() : points;
}

function removeDuplicateClosingPoint(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
	if (points.length > 1 && pointDistance(points[0], points[points.length - 1]) <= 0.01) {
		return points.slice(0, -1);
	}

	return points;
}

function getPointBounds(points: Array<{ x: number; y: number }>): BoardOutlineClip['bounds'] {
	return points.reduce((bounds, point) => ({
		left: Math.min(bounds.left, point.x),
		right: Math.max(bounds.right, point.x),
		top: Math.max(bounds.top, point.y),
		bottom: Math.min(bounds.bottom, point.y),
	}), {
		left: Number.POSITIVE_INFINITY,
		right: Number.NEGATIVE_INFINITY,
		top: Number.NEGATIVE_INFINITY,
		bottom: Number.POSITIVE_INFINITY,
	});
}

function pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>): boolean {
	let inside = false;
	for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
		const current = polygon[index];
		const previous = polygon[previousIndex];
		const intersects = ((current.y > point.y) !== (previous.y > point.y))
			&& point.x < (previous.x - current.x) * (point.y - current.y) / (previous.y - current.y) + current.x;
		if (intersects) {
			inside = !inside;
		}
	}
	return inside;
}

function sourcePointToPrimitiveUv(sourceX: number, sourceY: number, primitive: PcbImagePrimitiveInfo, isBottom: boolean): { u: number; v: number } {
	const [topLeft, topRight, , bottomLeft] = getPrimitiveSourceCorners(primitive);
	const point = { x: sourceX, y: sourceY };
	const right = { x: topRight.x - topLeft.x, y: topRight.y - topLeft.y };
	const down = { x: bottomLeft.x - topLeft.x, y: bottomLeft.y - topLeft.y };
	const delta = { x: point.x - topLeft.x, y: point.y - topLeft.y };
	const rightLengthSquared = right.x * right.x + right.y * right.y;
	const downLengthSquared = down.x * down.x + down.y * down.y;
	const rawU = rightLengthSquared > 0 ? (delta.x * right.x + delta.y * right.y) / rightLengthSquared : 0;
	const rawVFromTop = downLengthSquared > 0 ? (delta.x * down.x + delta.y * down.y) / downLengthSquared : 0;
	const mirroredU = primitive.mirror ? 1 - rawU : rawU;
	const u = isBottom ? 1 - mirroredU : mirroredU;
	const v = rawVFromTop;

	return { u, v };
}

function sourcePointToObjPoint(sourceX: number, sourceY: number, z: number): { x: number; y: number; z: number } {
	return {
		x: sourceX / EASYEDA_UNITS_PER_MM,
		y: -sourceY / EASYEDA_UNITS_PER_MM,
		z,
	};
}

function getPrimitiveUvs(primitive: PcbImagePrimitiveInfo, isBottom: boolean): Array<{ u: number; v: number }> {
	return getPrimitiveSourceCorners(primitive).map(point => sourcePointToPrimitiveUv(point.x, point.y, primitive, isBottom));
}

function getTextureMappingDiagnostics(
	imagePrimitives: Array<PcbImagePrimitiveInfo>,
	boardClip?: BoardOutlineClip,
): Array<unknown> {
	return imagePrimitives.map((primitive) => {
		const isBottom = primitive.layer === 4;
		const sourceBox = getPrimitiveSourceBox(primitive);
		const sourceCorners = getPrimitiveSourceCorners(primitive);
		const cornerUvs = getPrimitiveUvs(primitive, isBottom);
		const clipApplied = Boolean(boardClip && primitiveOverlapsClip(sourceBox, boardClip));
		const clipUvs = clipApplied && boardClip
			? boardClip.points.map(point => sourcePointToPrimitiveUv(point.x, point.y, primitive, isBottom))
			: [];
		return {
			primitiveId: primitive.primitiveId,
			layer: primitive.layer,
			isBottom,
			uvPolicy: isBottom
				? 'corner-basis-top-left-origin-v-down-bottom-physical-u-flip'
				: 'corner-basis-top-left-origin-v-down',
			sourceBox,
			sourceCorners,
			cornerUvs,
			clipApplied,
			clipSource: clipApplied ? boardClip?.source : undefined,
			clipPointCount: clipApplied ? boardClip?.points.length : 0,
			clipUvBounds: clipUvs.length > 0 ? getUvBounds(clipUvs) : undefined,
		};
	});
}

function getUvBounds(uvs: Array<{ u: number; v: number }>): { minU: number; maxU: number; minV: number; maxV: number } {
	return uvs.reduce((bounds, uv) => ({
		minU: Math.min(bounds.minU, uv.u),
		maxU: Math.max(bounds.maxU, uv.u),
		minV: Math.min(bounds.minV, uv.v),
		maxV: Math.max(bounds.maxV, uv.v),
	}), {
		minU: Number.POSITIVE_INFINITY,
		maxU: Number.NEGATIVE_INFINITY,
		minV: Number.POSITIVE_INFINITY,
		maxV: Number.NEGATIVE_INFINITY,
	});
}

function rotatePoint(x: number, y: number, centerX: number, centerY: number, degrees: number): { x: number; y: number } {
	if (!degrees) {
		return { x, y };
	}

	const radians = degrees * Math.PI / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	const dx = x - centerX;
	const dy = y - centerY;
	return {
		x: centerX + dx * cos - dy * sin,
		y: centerY + dx * sin + dy * cos,
	};
}

function normalizeAngle(degrees: number): number {
	const normalized = degrees % 360;
	return normalized < 0 ? normalized + 360 : normalized;
}

function sanitizeMaterialName(value: string): string {
	return value.replace(/\W/g, '_');
}

function formatNumber(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
}

async function runApiProbe(
	probeName: string,
	api: string,
	note: string,
	readApi: () => Promise<unknown>,
): Promise<void> {
	const startedAt = new Date();
	try {
		showToast(`BetterExport probe started: ${probeName}`, 'info', 5000);
		const result = await readApi();
		const finishedAt = new Date();
		const payload: ProbePayload = {
			probeName,
			api,
			startedAt: startedAt.toISOString(),
			finishedAt: finishedAt.toISOString(),
			status: 'returned',
			elapsedMs: finishedAt.getTime() - startedAt.getTime(),
			result,
			notes: [
				note,
				'If this JSON saved, the API returned control to the extension runtime.',
			],
		};
		await saveProbePayload(payload);
		showInfo(`Probe returned successfully.\n\n${probeName}\nElapsed: ${payload.elapsedMs} ms`, 'BetterExport API Probe');
	}
	catch (error) {
		const finishedAt = new Date();
		const payload: ProbePayload = {
			probeName,
			api,
			startedAt: startedAt.toISOString(),
			finishedAt: finishedAt.toISOString(),
			status: 'threw',
			elapsedMs: finishedAt.getTime() - startedAt.getTime(),
			error: getErrorMessage(error),
			notes: [note],
		};
		await saveProbePayload(payload);
		showInfo(`Probe threw an error.\n\n${probeName}\n${payload.error}`, 'BetterExport API Probe Error');
	}
}

async function saveProbePayload(payload: ProbePayload): Promise<void> {
	const fileName = `${PROBE_BASENAME}-${sanitizeFileNamePart(payload.probeName)}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
	const saveResult = await saveJsonPayload(payload, fileName);
	if (saveResult.method === 'failed') {
		showInfo(`Probe completed, but JSON save failed:\n${saveResult.error ?? 'Unknown error'}`, 'BetterExport API Probe');
	}
}

async function summarizeFileResult(file: File | undefined): Promise<unknown> {
	if (!file) {
		return {
			returnedFile: false,
		};
	}

	const textPreview = await tryReadFileTextPreview(file);
	await eda.sys_FileSystem.saveFile(file, file.name || `better-export-returned-file-${new Date().toISOString().replace(/[:.]/g, '-')}`);

	return {
		returnedFile: true,
		name: file.name,
		size: file.size,
		type: file.type,
		lastModified: file.lastModified,
		textPreview,
		rawFileSaveAttempted: true,
	};
}

async function tryReadFileTextPreview(file: File): Promise<unknown> {
	try {
		const text = await file.text();
		return {
			readableAsText: true,
			length: text.length,
			preview: summarizeText(text, 1600),
			containsObjImageMarker: text.includes('["OBJ"'),
			containsBlobMarker: text.includes('blob:'),
		};
	}
	catch (error) {
		return {
			readableAsText: false,
			error: getErrorMessage(error),
		};
	}
}

async function runExportPrimitiveImagePlacementInfo(): Promise<void> {
	try {
		const imagePrimitives = await readPrimitiveImageFallback();
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const outputName = `${EXPORT_BASENAME}-placements-${timestamp}.json`;
		const warnings = [
			'This export intentionally uses eda.pcb_PrimitiveImage.getAll() only. In this EasyEDA install, getDocumentSource() and pcb_PrimitiveObject.getAll() can hang the extension runtime.',
			'This placement API does not expose image filename, blob reference, or PNG bytes.',
		];
		const blobRecoveryResults: Array<BlobRecoveryResult> = imagePrimitives.map(primitive => ({
			primitiveId: primitive.primitiveId,
			recovered: false,
			error: 'Filename, blob reference, and PNG bytes are unavailable from eda.pcb_PrimitiveImage.getAll().',
		}));
		const payload: ExportPayload = {
			generatedAt: new Date().toISOString(),
			source: 'eda.pcb_PrimitiveImage.getAll',
			documentSourceAvailable: false,
			warnings,
			imagePrimitiveCount: imagePrimitives.length,
			imagePrimitives,
			blobRecovery: {
				supported: false,
				note: 'This EasyEDA API returns image placements only. It does not expose filename, blob reference, or image bytes.',
				results: blobRecoveryResults,
			},
			notes: [
				'This is the non-hanging export path for the current EasyEDA extension environment.',
				'It is enough to confirm image primitive count and placement, but not enough to recover Blender textures by itself.',
			],
		};

		const saveResult = await saveJsonPayload(payload, outputName);
		showSummary(imagePrimitives, saveResult, blobRecoveryResults, warnings);
	}
	catch (error) {
		showInfo(`Placement export failed:\n${getErrorMessage(error)}`, 'BetterExport Error');
	}
}

async function runRawDocumentSourceExport(): Promise<void> {
	try {
		showToast('BetterExport: reading PCB source.', 'info', 5000);

		const sourceResult = await readDocumentSourceWithTimeout(DOCUMENT_SOURCE_TIMEOUT_MS);
		const warnings: Array<string> = [];
		let imagePrimitives: Array<PcbImagePrimitiveInfo>;
		let source: ExportPayload['source'];

		if (sourceResult.status === 'ok' && sourceResult.documentSource) {
			imagePrimitives = parseImageObjLines(sourceResult.documentSource);
			source = 'eda.sys_FileManager.getDocumentSource';
		}
		else {
			const reason = sourceResult.status === 'timeout'
				? `eda.sys_FileManager.getDocumentSource() did not return within ${DOCUMENT_SOURCE_TIMEOUT_MS / 1000} seconds.`
				: `eda.sys_FileManager.getDocumentSource() failed: ${sourceResult.error}`;
			warnings.push(reason);
			warnings.push('Fallback data comes from eda.pcb_PrimitiveImage.getAll(), which does not expose filename or blob reference fields.');
			showInfo(`${reason}\n\nBetterExport will now export fallback placement data without filenames/blob references.`, 'BetterExport Source Fallback');
			imagePrimitives = await readPrimitiveImageFallback();
			source = 'eda.pcb_PrimitiveImage.getAll';
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const outputName = `${EXPORT_BASENAME}-${timestamp}.json`;
		const blobRecoveryResults: Array<BlobRecoveryResult> = imagePrimitives.map(primitive => ({
			primitiveId: primitive.primitiveId,
			filename: primitive.filename,
			blobReference: primitive.blobReference,
			recovered: false,
			error: 'PNG byte recovery is not attempted in the main export command so the JSON save dialog appears immediately.',
		}));

		const payload: ExportPayload = {
			generatedAt: new Date().toISOString(),
			source,
			documentSourceAvailable: source === 'eda.sys_FileManager.getDocumentSource',
			warnings,
			imagePrimitiveCount: imagePrimitives.length,
			imagePrimitives,
			blobRecovery: {
				supported: false,
				note: 'The main export command writes JSON only. EasyEDA exposes blob:<hash> references in the PCB source, but the documented APIs do not expose a direct blob resolver.',
				results: blobRecoveryResults,
			},
			notes: [
				'EasyEDA Pro OBJ/MTL export currently emits flat material colors and does not include map_Kd texture references for colorful silkscreen image primitives.',
				'This JSON preserves placement metadata and blob references so the texture recovery pipeline can be completed separately if the PNG bytes become available.',
			],
		};

		showToast(`BetterExport: found ${imagePrimitives.length} image primitive(s). Choose where to save the JSON.`, 'info', 8000);
		const saveResult = await saveJsonPayload(payload, outputName);
		showSummary(imagePrimitives, saveResult, blobRecoveryResults, warnings);
	}
	catch (error) {
		const message = getErrorMessage(error);
		showToast(`BetterExport failed: ${message}`, 'error', 8000);
		showInfo(`Export failed:\n${message}`, 'BetterExport Error');
	}
}

function parseImageObjLines(documentSource: string): Array<PcbImagePrimitiveInfo> {
	const results: Array<PcbImagePrimitiveInfo> = [];
	const lines = documentSource.split(/\r?\n/);

	lines.forEach((line, index) => {
		const trimmed = line.trim().replace(/,$/, '');
		if (!trimmed.startsWith('["OBJ"')) {
			return;
		}

		try {
			const row = JSON.parse(trimmed) as Array<unknown>;
			const parsed = parseObjRow(row, index + 1);
			if (parsed) {
				results.push(parsed);
			}
		}
		catch {
			const extractedRows = extractObjRowsFromLine(trimmed);
			for (const row of extractedRows) {
				const parsed = parseObjRow(row, index + 1);
				if (parsed) {
					results.push(parsed);
				}
			}
		}
	});

	if (results.length > 0) {
		return results;
	}

	for (const row of extractObjRowsFromLine(documentSource)) {
		const parsed = parseObjRow(row, 0);
		if (parsed) {
			results.push(parsed);
		}
	}

	return results;
}

function selectBoardClipForImagePrimitives(
	candidates: Array<BoardOutlineCandidate>,
	imagePrimitives: Array<PcbImagePrimitiveInfo>,
	warnings: Array<string>,
): BoardOutlineClip | undefined {
	if (candidates.length === 0 || imagePrimitives.length === 0) {
		if (imagePrimitives.length > 0) {
			warnings.push('No board outline candidates were parsed from PCB/*.epcb files.');
		}
		return undefined;
	}

	warnings.push(`Parsed ${candidates.length} board outline candidate(s).`);

	const imageBoxes = imagePrimitives.map(getPrimitiveSourceBox);
	const scored = candidates
		.map((candidate) => {
			const matches = imageBoxes.map((box) => {
				const imageArea = getBoundsArea(box);
				const overlapArea = getBoundsOverlapArea(box, candidate.bounds);
				const overlapRatio = imageArea > 0 ? overlapArea / imageArea : 0;
				const areaRatio = imageArea > 0 ? candidate.area / imageArea : 0;
				const contained = primitiveContainsClip(box, candidate);
				return {
					score: contained ? 2 + areaRatio : overlapRatio,
					matchKind: contained ? 'contained' as const : 'overlap-fallback' as const,
					overlapRatio,
					areaRatio,
				};
			}).sort((left, right) => right.score - left.score)[0];

			return {
				...candidate,
				score: matches?.score ?? -1,
				matchKind: matches?.matchKind,
				overlapRatio: matches?.overlapRatio,
				areaRatio: matches?.areaRatio,
			};
		})
		.sort((left, right) => (right.score ?? -1) - (left.score ?? -1) || right.area - left.area);

	const selected = scored[0];
	if (!selected || (selected.score ?? -1) <= 0) {
		warnings.push(`Found ${candidates.length} board outline candidate(s), but none fit inside the image primitive bounds; image primitives will export as rectangles.`);
		return undefined;
	}

	if (selected.matchKind === 'overlap-fallback') {
		warnings.push(`Selected board outline ${selected.id} by overlap fallback from ${selected.zipPath ?? 'unknown PCB source'} with overlap ratio ${formatNumber(selected.overlapRatio ?? 0)}.`);
	}
	else {
		warnings.push(`Selected board outline ${selected.id} from ${selected.zipPath ?? 'unknown PCB source'} with ${selected.points.length} point(s).`);
	}
	return selected;
}

function parseBoardOutlineClip(documentSource: string, zipPath?: string): BoardOutlineCandidate | undefined {
	const lines = documentSource.split(/\r?\n/);
	const shapeLoops: Array<Array<{ x: number; y: number }>> = [];
	const segments: Array<BoardOutlineSegment> = [];
	const seenRows = new Set<string>();

	const readRow = (row: Array<unknown>, sourceLine: number): void => {
		const rowKey = JSON.stringify(row);
		if (seenRows.has(rowKey)) {
			return;
		}
		seenRows.add(rowKey);

		try {
			const shapeLoop = parseBoardOutlineShapeLoop(row, sourceLine);
			if (shapeLoop) {
				shapeLoops.push(shapeLoop);
			}
			const segment = parseBoardOutlineSegmentRow(row, sourceLine);
			if (segment) {
				segments.push(segment);
			}
		}
		catch {
			// Ignore non-JSON POLY rows. Image extraction should continue.
		}
	};

	lines.forEach((line, index) => {
		const row = parseJsonLineArray(line);
		if (row?.[0] === 'POLY' || row?.[0] === 'LINE') {
			readRow(row, index + 1);
		}
	});

	for (const row of extractRowsByType(documentSource, 'POLY')) {
		readRow(row, 0);
	}
	for (const row of extractRowsByType(documentSource, 'LINE')) {
		readRow(row, 0);
	}

	const segmentLoops = buildBoardOutlineLoops(segments);
	const allLoops = [...segmentLoops, ...shapeLoops];
	if (allLoops.length > 0) {
		return createBoardOutlineClipFromLoops(allLoops, segmentLoops.length > 0 ? 'outline-segments' : 'circle', zipPath, segments[0]?.sourceLine);
	}

	return undefined;
}

function createBoardOutlineClipFromLoops(
	loops: Array<Array<{ x: number; y: number }>>,
	source: BoardOutlineClip['source'],
	zipPath?: string,
	sourceLine?: number,
): BoardOutlineCandidate | undefined {
	const normalizedLoops = loops
		.map(removeDuplicateClosingPoint)
		.filter(points => points.length >= 3)
		.map(points => ({ points, area: Math.abs(getPolygonSignedArea(points)) }))
		.sort((left, right) => right.area - left.area);

	const outerLoop = normalizedLoops[0];
	if (!outerLoop) {
		return undefined;
	}

	const candidateHoles = normalizedLoops.slice(1)
		.filter(loop => loop.area > 0 && loop.area < outerLoop.area * 0.95)
		.filter(loop => pointInPolygon(loop.points[0], outerLoop.points))
		.map(loop => loop.points);
	return createBoardOutlineClipWithHoles(outerLoop.points, candidateHoles, source, zipPath, sourceLine);
}

function createBoardOutlineClipWithHoles(
	points: Array<{ x: number; y: number }>,
	holes: Array<Array<{ x: number; y: number }>>,
	source: BoardOutlineClip['source'],
	zipPath?: string,
	sourceLine?: number,
): BoardOutlineCandidate | undefined {
	const normalizedPoints = removeDuplicateClosingPoint(points);
	if (normalizedPoints.length < 3) {
		return undefined;
	}

	const normalizedHoles = holes
		.map(removeDuplicateClosingPoint)
		.filter(hole => hole.length >= 3 && pointInPolygon(hole[0], normalizedPoints));
	const bounds = getPointBounds(normalizedPoints);
	const signedArea = getPolygonSignedArea(normalizedPoints);
	const area = Math.max(0, Math.abs(signedArea) - normalizedHoles.reduce((sum, hole) => sum + Math.abs(getPolygonSignedArea(hole)), 0));
	const warnings: Array<string> = [];
	if (area <= 0) {
		warnings.push('Parsed board outline has zero area.');
	}
	if (source === 'outline-segments' && normalizedPoints.length < 16) {
		warnings.push('Parsed outline has very few sampled points; arc parsing may be incomplete.');
	}
	if (normalizedHoles.length > 0) {
		warnings.push(`Parsed ${normalizedHoles.length} internal board cutout loop(s).`);
	}

	return {
		id: `${sourceLine ?? 0}-${source}-${normalizedPoints.length}-holes-${normalizedHoles.length}`,
		points: normalizedPoints,
		holes: normalizedHoles,
		source,
		zipPath,
		sourceLine,
		area,
		bounds,
		warnings,
	};
}

function parseBoardOutlineShapeLoop(row: Array<unknown>, sourceLine: number): Array<{ x: number; y: number }> | undefined {
	const circle = parseBoardOutlineCircleRow(row, sourceLine);
	if (circle) {
		return buildCirclePoints(circle);
	}

	const layer = toNumber(row[4]);
	const shape = row[6];
	if (row[0] !== 'POLY' || layer !== 11 || !Array.isArray(shape) || shape[0] !== 'R') {
		return undefined;
	}

	const left = toNumber(shape[1]);
	const top = toNumber(shape[2]);
	const width = toNumber(shape[3]);
	const height = toNumber(shape[4]);
	const rotation = toNumber(shape[5]);
	const points = buildRectangleShapePoints(left, top, width, height, rotation);
	return points.length >= 3 ? points : undefined;
}

function buildRectangleShapePoints(left: number, top: number, width: number, height: number, rotation: number): Array<{ x: number; y: number }> {
	if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		return [];
	}

	const centerX = left + width / 2;
	const centerY = top - height / 2;
	return [
		{ x: left, y: top },
		{ x: left + width, y: top },
		{ x: left + width, y: top - height },
		{ x: left, y: top - height },
	].map(point => rotatePoint(point.x, point.y, centerX, centerY, rotation));
}

function parseBoardOutlineCircleRow(row: Array<unknown>, sourceLine: number): BoardCircleClip | undefined {
	const layer = toNumber(row[4]);
	const shape = row[6];
	if (row[0] !== 'POLY' || layer !== 11 || !Array.isArray(shape) || shape[0] !== 'CIRCLE') {
		return undefined;
	}

	const centerX = toNumber(shape[1]);
	const centerY = toNumber(shape[2]);
	const radius = toNumber(shape[3]);
	if (!Number.isFinite(centerX) || !Number.isFinite(centerY) || !Number.isFinite(radius) || radius <= 0) {
		return undefined;
	}

	return { centerX, centerY, radius, sourceLine };
}

function parseBoardOutlineSegmentRow(row: Array<unknown>, sourceLine: number): BoardOutlineSegment | undefined {
	const layer = toNumber(row[4]);
	if (row[0] === 'LINE' && layer === 11) {
		const start = { x: toNumber(row[5]), y: toNumber(row[6]) };
		const end = { x: toNumber(row[7]), y: toNumber(row[8]) };
		return Number.isFinite(start.x) && Number.isFinite(start.y) && Number.isFinite(end.x) && Number.isFinite(end.y)
			? { start, end, sourceLine }
			: undefined;
	}

	const shape = row[6];
	if (row[0] !== 'POLY' || layer !== 11 || !Array.isArray(shape) || shape.length < 5) {
		return undefined;
	}

	const start = { x: toNumber(shape[0]), y: toNumber(shape[1]) };
	const command = shape[2];
	if (!Number.isFinite(start.x) || !Number.isFinite(start.y)) {
		return undefined;
	}

	if (command === 'L') {
		const end = { x: toNumber(shape[3]), y: toNumber(shape[4]) };
		return Number.isFinite(end.x) && Number.isFinite(end.y) ? { start, end, sourceLine } : undefined;
	}

	if (command === 'CARC') {
		const arcAngle = toNumber(shape[3]);
		const end = { x: toNumber(shape[4]), y: toNumber(shape[5]) };
		return Number.isFinite(end.x) && Number.isFinite(end.y) && Number.isFinite(arcAngle)
			? { start, end, arcAngle, sourceLine }
			: undefined;
	}

	return undefined;
}

function buildCirclePoints(circle: BoardCircleClip): Array<{ x: number; y: number }> {
	const points: Array<{ x: number; y: number }> = [];
	for (let index = 0; index < CIRCLE_CLIP_SEGMENTS; index += 1) {
		const angle = (Math.PI * 2 * index) / CIRCLE_CLIP_SEGMENTS;
		points.push({
			x: circle.centerX + Math.cos(angle) * circle.radius,
			y: circle.centerY + Math.sin(angle) * circle.radius,
		});
	}
	return points;
}

function buildBoardOutlineLoops(segments: Array<BoardOutlineSegment>): Array<Array<{ x: number; y: number }>> {
	const loops: Array<Array<{ x: number; y: number }>> = [];
	const unused = [...segments];

	while (unused.length > 0) {
		const first = unused.shift()!;
		const ordered: Array<BoardOutlineSegment> = [first];
		let currentEnd = first.end;

		while (unused.length > 0) {
			let bestIndex = -1;
			let reverse = false;
			let bestDistance = Number.POSITIVE_INFINITY;
			for (let index = 0; index < unused.length; index += 1) {
				const segment = unused[index];
				const startDistance = pointDistance(currentEnd, segment.start);
				const endDistance = pointDistance(currentEnd, segment.end);
				if (startDistance < bestDistance) {
					bestDistance = startDistance;
					bestIndex = index;
					reverse = false;
				}
				if (endDistance < bestDistance) {
					bestDistance = endDistance;
					bestIndex = index;
					reverse = true;
				}
			}

			if (bestIndex < 0 || bestDistance > 2) {
				break;
			}

			const [next] = unused.splice(bestIndex, 1);
			const orderedSegment = reverse ? reverseBoardOutlineSegment(next) : next;
			ordered.push(orderedSegment);
			currentEnd = orderedSegment.end;
		}

		if (ordered.length < 3 || pointDistance(ordered[ordered.length - 1].end, ordered[0].start) > 2) {
			continue;
		}

		const points: Array<{ x: number; y: number }> = [];
		for (const segment of ordered) {
			const segmentPoints = sampleBoardOutlineSegment(segment);
			for (const point of segmentPoints) {
				if (points.length === 0 || pointDistance(points[points.length - 1], point) > 0.01) {
					points.push(point);
				}
			}
		}

		loops.push(removeDuplicateClosingPoint(points));
	}

	return loops;
}

function reverseBoardOutlineSegment(segment: BoardOutlineSegment): BoardOutlineSegment {
	return {
		start: segment.end,
		end: segment.start,
		arcAngle: segment.arcAngle === undefined ? undefined : -segment.arcAngle,
		sourceLine: segment.sourceLine,
	};
}

function sampleBoardOutlineSegment(segment: BoardOutlineSegment): Array<{ x: number; y: number }> {
	if (!segment.arcAngle) {
		return [segment.start, segment.end];
	}

	const chordLength = pointDistance(segment.start, segment.end);
	const theta = Math.abs(segment.arcAngle) * Math.PI / 180;
	if (chordLength <= 0 || theta <= 0.0001) {
		return [segment.start, segment.end];
	}

	const radius = chordLength / (2 * Math.sin(theta / 2));
	const centerOffset = radius * Math.cos(theta / 2);
	const dx = (segment.end.x - segment.start.x) / chordLength;
	const dy = (segment.end.y - segment.start.y) / chordLength;
	const rightNormal = { x: dy, y: -dx };
	const sign = segment.arcAngle >= 0 ? -1 : 1;
	const midpoint = { x: (segment.start.x + segment.end.x) / 2, y: (segment.start.y + segment.end.y) / 2 };
	const center = {
		x: midpoint.x + rightNormal.x * centerOffset * sign,
		y: midpoint.y + rightNormal.y * centerOffset * sign,
	};
	const startAngle = Math.atan2(segment.start.y - center.y, segment.start.x - center.x);
	const sweep = segment.arcAngle * Math.PI / 180;
	const steps = Math.max(6, Math.ceil(Math.abs(segment.arcAngle) / 5));
	const points: Array<{ x: number; y: number }> = [];
	for (let index = 0; index <= steps; index += 1) {
		const angle = startAngle + (sweep * index) / steps;
		points.push({
			x: center.x + Math.cos(angle) * radius,
			y: center.y + Math.sin(angle) * radius,
		});
	}
	return points;
}

function pointDistance(first: { x: number; y: number }, second: { x: number; y: number }): number {
	return Math.hypot(first.x - second.x, first.y - second.y);
}

function parseComponentPlacements(documentSource: string): Array<PcbComponentPlacement> {
	const componentsById = new Map<string, PcbComponentPlacement>();
	const lines = documentSource.split(/\r?\n/);

	lines.forEach((line) => {
		const row = parseJsonLineArray(line);
		if (!row) {
			return;
		}

		if (row[0] === 'COMPONENT' && typeof row[1] === 'string') {
			componentsById.set(row[1], {
				componentId: row[1],
				layer: toNumber(row[3]),
				x: toNumber(row[4]),
				y: toNumber(row[5]),
				rotation: toNumber(row[6]),
			});
			return;
		}

		if (row[0] === 'ATTR' && typeof row[3] === 'string' && row[7] === 'Footprint' && typeof row[8] === 'string') {
			const component = componentsById.get(row[3]);
			if (component) {
				component.footprintId = row[8];
			}
		}
	});

	return [...componentsById.values()].filter(component => Boolean(component.footprintId));
}

function parseStandalonePcbPads(documentSource: string): Array<GeneratedPad> {
	const pads: Array<GeneratedPad> = [];

	for (const line of documentSource.split(/\r?\n/)) {
		const row = parseJsonLineArray(line);
		if (!row || row[0] !== 'PAD' || typeof row[1] !== 'string' || typeof row[5] !== 'string') {
			continue;
		}

		const layer = toNumber(row[4]);
		if (layer !== 1 && layer !== 2 && layer !== 12) {
			continue;
		}

		const shape = row[10];
		if (!Array.isArray(shape)) {
			continue;
		}

		const padShape = parsePadShape(shape, toNumber(row[14]));
		if (!padShape) {
			continue;
		}

		const sourcePadRotation = padShape.rotation;
		const padRotation = GENERATED_PAD_Y_AXIS_FLIP ? -sourcePadRotation : sourcePadRotation;
		const outputLayers = layer === 12 ? [1, 2] : [layer];
		for (const outputLayer of outputLayers) {
			pads.push({
				componentId: '(pcb)',
				footprintId: '(standalone)',
				padId: row[1],
				number: row[5],
				componentLayer: outputLayer,
				layer: outputLayer,
				transform: GENERATED_PAD_Y_AXIS_FLIP ? 'pcb-absolute-board-y' : 'top',
				x: toNumber(row[6]),
				y: GENERATED_PAD_Y_AXIS_FLIP ? -toNumber(row[7]) : toNumber(row[7]),
				width: padShape.width,
				height: padShape.height,
				rotation: normalizeAngle(padRotation),
				shape: padShape.shape,
				drill: parsePadDrill(row[9]),
			});
		}
	}

	return pads;
}

function parseBoardSlotRegionHoles(documentSource: string): Array<Array<{ x: number; y: number }>> {
	const holes: Array<Array<{ x: number; y: number }>> = [];

	for (const line of documentSource.split(/\r?\n/)) {
		const row = parseJsonLineArray(line);
		if (!row || row[0] !== 'FILL' || toNumber(row[4]) !== 12 || !Array.isArray(row[7])) {
			continue;
		}

		for (const shape of row[7]) {
			if (!Array.isArray(shape)) {
				continue;
			}

			const polygon = parseFilledShapeLoop(shape).map(point => ({
				x: point.x,
				y: GENERATED_PAD_Y_AXIS_FLIP ? -point.y : point.y,
			}));
			if (polygon.length >= 3) {
				holes.push(polygon);
			}
		}
	}

	return holes;
}

function parseFilledShapeLoop(shape: Array<unknown>): Array<{ x: number; y: number }> {
	if (shape[0] === 'R') {
		return buildRectangleShapePoints(
			toNumber(shape[1]),
			toNumber(shape[2]),
			toNumber(shape[3]),
			toNumber(shape[4]),
			toNumber(shape[5]),
		);
	}

	if (shape[0] === 'CIRCLE') {
		const circle = {
			centerX: toNumber(shape[1]),
			centerY: toNumber(shape[2]),
			radius: toNumber(shape[3]),
			sourceLine: 0,
		};
		return Number.isFinite(circle.centerX) && Number.isFinite(circle.centerY) && Number.isFinite(circle.radius) && circle.radius > 0
			? buildCirclePoints(circle)
			: [];
	}

	if (Number.isFinite(toNumber(shape[0])) && Number.isFinite(toNumber(shape[1])) && shape[2] === 'L') {
		const points: Array<{ x: number; y: number }> = [
			{
				x: toNumber(shape[0]),
				y: toNumber(shape[1]),
			},
		];

		for (let index = 3; index < shape.length - 1; index += 2) {
			const x = toNumber(shape[index]);
			const y = toNumber(shape[index + 1]);
			if (Number.isFinite(x) && Number.isFinite(y)) {
				points.push({ x, y });
			}
		}

		return removeDuplicateClosingPoint(points);
	}

	return [];
}

function parseBottomCopperCircleStrokes(documentSource: string): Array<GeneratedCopperCircle> {
	const circles: Array<GeneratedCopperCircle> = [];

	for (const line of documentSource.split(/\r?\n/)) {
		const row = parseJsonLineArray(line);
		if (!row || row[0] !== 'POLY' || typeof row[1] !== 'string') {
			continue;
		}

		const layer = toNumber(row[4]);
		const width = toNumber(row[5]);
		const shape = row[6];
		if (layer !== 2 || !Array.isArray(shape) || shape[0] !== 'CIRCLE') {
			continue;
		}

		const centerX = toNumber(shape[1]);
		const centerY = toNumber(shape[2]);
		const radius = toNumber(shape[3]);
		if (
			!Number.isFinite(centerX)
			|| !Number.isFinite(centerY)
			|| !Number.isFinite(radius)
			|| !Number.isFinite(width)
			|| radius < 0
			|| width <= 0
		) {
			continue;
		}

		circles.push({
			primitiveId: row[1],
			net: typeof row[3] === 'string' ? row[3] : '',
			layer,
			centerX,
			centerY,
			radius,
			width,
		});
	}

	return circles;
}

function generatePadsFromFootprints(
	componentPlacements: Array<PcbComponentPlacement>,
	footprintSourcesById: Map<string, string>,
	warnings: Array<string>,
): Array<GeneratedPad> {
	const pads: Array<GeneratedPad> = [];
	const parsedFootprints = new Map<string, Array<FootprintPad>>();

	for (const component of componentPlacements) {
		if (!component.footprintId) {
			continue;
		}

		let footprintPads = parsedFootprints.get(component.footprintId);
		if (!footprintPads) {
			const footprintSource = footprintSourcesById.get(component.footprintId);
			if (!footprintSource) {
				warnings.push(`No FOOTPRINT/*.efoo file matched footprint ${component.footprintId} for component ${component.componentId}.`);
				continue;
			}

			footprintPads = parseFootprintPads(footprintSource);
			parsedFootprints.set(component.footprintId, footprintPads);
		}

		for (const pad of footprintPads) {
			if (pad.layer !== 1 && pad.layer !== 12) {
				continue;
			}

			const isBottomComponent = component.layer === 2;
			const localX = isBottomComponent ? -pad.x : pad.x;
			const localY = isBottomComponent ? -pad.y : pad.y;
			const rotatedCenter = rotatePoint(localX, localY, 0, 0, component.rotation);
			const placedX = component.x + rotatedCenter.x;
			const placedY = component.y + rotatedCenter.y;
			const sourcePadRotation = component.rotation + (isBottomComponent ? -pad.rotation : pad.rotation);
			const padRotation = GENERATED_PAD_Y_AXIS_FLIP ? -sourcePadRotation : sourcePadRotation;
			const outputLayers = pad.layer === 12 ? [1, 2] : [isBottomComponent ? 2 : 1];
			for (const outputLayer of outputLayers) {
				pads.push({
					componentId: component.componentId,
					footprintId: component.footprintId,
					padId: pad.padId,
					number: pad.number,
					componentLayer: component.layer,
					layer: outputLayer,
					transform: GENERATED_PAD_Y_AXIS_FLIP
						? isBottomComponent
							? 'bottom-mirrored-xy-board-y'
							: 'top-board-y'
						: isBottomComponent ? 'bottom-mirrored-xy' : 'top',
					x: placedX,
					y: GENERATED_PAD_Y_AXIS_FLIP ? -placedY : placedY,
					width: pad.width,
					height: pad.height,
					rotation: normalizeAngle(padRotation),
					shape: pad.shape,
					drill: pad.drill,
				});
			}
		}
	}

	return pads;
}

function parseFootprintPads(footprintSource: string): Array<FootprintPad> {
	const pads: Array<FootprintPad> = [];

	for (const line of footprintSource.split(/\r?\n/)) {
		const row = parseJsonLineArray(line);
		if (!row || row[0] !== 'PAD' || typeof row[1] !== 'string' || typeof row[5] !== 'string') {
			continue;
		}

		const shape = row[10];
		if (!Array.isArray(shape)) {
			continue;
		}

		const padShape = parsePadShape(shape, toNumber(row[14]));
		if (!padShape) {
			continue;
		}

		pads.push({
			padId: row[1],
			number: row[5],
			layer: toNumber(row[4]),
			x: toNumber(row[6]),
			y: toNumber(row[7]),
			width: padShape.width,
			height: padShape.height,
			rotation: padShape.rotation,
			shape: padShape.shape,
			drill: parsePadDrill(row[9]),
		});
	}

	return pads;
}

function parsePadShape(shape: Array<unknown>, fallbackRotation: number): Pick<FootprintPad, 'shape' | 'width' | 'height' | 'rotation'> | undefined {
	const shapeType = shape[0];
	if (shapeType === 'RECT') {
		return { shape: 'rect', width: toNumber(shape[1]), height: toNumber(shape[2]), rotation: toNumber(shape[3]) };
	}
	if (shapeType === 'ELLIPSE') {
		return { shape: 'ellipse', width: toNumber(shape[1]), height: toNumber(shape[2]), rotation: toNumber(shape[3]) };
	}
	if (shapeType === 'OVAL') {
		const rotation = Number.isFinite(toNumber(shape[3])) && shape[3] !== undefined ? toNumber(shape[3]) : fallbackRotation;
		return { shape: 'oval', width: toNumber(shape[1]), height: toNumber(shape[2]), rotation };
	}
	return undefined;
}

function parsePadDrill(value: unknown): FootprintPadDrill | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}

	const drillType = value[0];
	const width = toNumber(value[1]);
	const height = toNumber(value[2]);
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		return undefined;
	}

	if (drillType === 'ROUND') {
		return { shape: 'round', width, height };
	}
	if (drillType === 'SLOT') {
		return { shape: 'slot', width, height };
	}

	return undefined;
}

function parseJsonLineArray(line: string): Array<unknown> | undefined {
	const trimmed = line.trim().replace(/,$/, '');
	if (!trimmed.startsWith('[')) {
		return undefined;
	}

	try {
		const parsed = JSON.parse(trimmed) as unknown;
		return Array.isArray(parsed) ? parsed : undefined;
	}
	catch {
		return undefined;
	}
}

async function readPrimitiveImageFallback(): Promise<Array<PcbImagePrimitiveInfo>> {
	const primitives = await eda.pcb_PrimitiveImage.getAll();
	return primitives.map((primitive) => {
		const primitiveId = primitive.getState_PrimitiveId();
		return {
			primitiveId,
			layer: Number(primitive.getState_Layer()),
			x: primitive.getState_X(),
			y: primitive.getState_Y(),
			width: primitive.getState_Width(),
			height: primitive.getState_Height(),
			rotation: primitive.getState_Rotation(),
			mirror: primitive.getState_HorizonMirror(),
			mirrorRaw: primitive.getState_HorizonMirror(),
			sourceApi: 'primitive-image-api',
		};
	});
}

async function readDocumentSourceWithTimeout(timeoutMs: number): Promise<
	| { status: 'ok'; documentSource: string | undefined }
	| { status: 'timeout' }
	| { status: 'error'; error: string }
> {
	try {
		const result = await Promise.race([
			eda.sys_FileManager.getDocumentSource().then(documentSource => ({ status: 'ok' as const, documentSource })),
			new Promise<{ status: 'timeout' }>(resolve => setTimeout(() => resolve({ status: 'timeout' }), timeoutMs)),
		]);
		return result;
	}
	catch (error) {
		return { status: 'error', error: getErrorMessage(error) };
	}
}

function parseObjRow(row: Array<unknown>, sourceLine: number): PcbImagePrimitiveInfo | undefined {
	if (row[0] !== 'OBJ' || typeof row[1] !== 'string' || typeof row[4] !== 'string') {
		return undefined;
	}

	const blobReference = typeof row[11] === 'string' ? row[11] : '';
	if (!blobReference.startsWith('blob:')) {
		return undefined;
	}

	return {
		primitiveId: row[1],
		layer: toNumber(row[3]),
		filename: row[4],
		x: toNumber(row[5]),
		y: toNumber(row[6]),
		width: toNumber(row[7]),
		height: toNumber(row[8]),
		rotation: toNumber(row[9]),
		mirror: toBoolean(row[10]),
		mirrorRaw: row[10],
		blobReference,
		sourceLine,
		sourceApi: 'document-source',
	};
}

function extractObjRowsFromLine(text: string): Array<Array<unknown>> {
	return extractRowsByType(text, 'OBJ');
}

function extractRowsByType(text: string, rowType: string): Array<Array<unknown>> {
	const rows: Array<Array<unknown>> = [];
	const marker = `["${rowType}"`;
	let searchFrom = 0;

	while (searchFrom < text.length) {
		const start = text.indexOf(marker, searchFrom);
		if (start < 0) {
			break;
		}

		const rowText = extractJsonArrayAt(text, start);
		searchFrom = start + marker.length;
		if (!rowText) {
			continue;
		}

		try {
			const parsed = JSON.parse(rowText) as unknown;
			if (Array.isArray(parsed) && parsed[0] === rowType) {
				rows.push(parsed);
			}
		}
		catch {
			// Skip malformed candidates; the export should continue for other rows.
		}
	}

	return rows;
}

function extractJsonArrayAt(text: string, start: number): string | undefined {
	let depth = 0;
	let inString = false;
	let escaped = false;

	for (let index = start; index < text.length; index += 1) {
		const char = text[index];

		if (inString) {
			if (escaped) {
				escaped = false;
			}
			else if (char === '\\') {
				escaped = true;
			}
			else if (char === '"') {
				inString = false;
			}
			continue;
		}

		if (char === '"') {
			inString = true;
			continue;
		}

		if (char === '[') {
			depth += 1;
		}
		else if (char === ']') {
			depth -= 1;
			if (depth === 0) {
				return text.slice(start, index + 1);
			}
		}
	}

	return undefined;
}

async function saveJsonPayload(payload: ExportPayload, fileName: string): Promise<FileSaveResult> {
	const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
	try {
		showToast(`BetterExport: choose where to save ${fileName}`, 'info', 6000);
		await eda.sys_FileSystem.saveFile(blob, fileName);
		return { method: 'save-dialog', path: fileName };
	}
	catch (error) {
		return { method: 'failed', error: getErrorMessage(error) };
	}
}

function showSummary(
	imagePrimitives: Array<PcbImagePrimitiveInfo>,
	saveResult: FileSaveResult,
	blobRecoveryResults: Array<BlobRecoveryResult>,
	warnings: Array<string>,
): void {
	const primitiveLines = imagePrimitives.length > 0
		? imagePrimitives.map(primitive =>
				`${primitive.primitiveId}: layer ${primitive.layer}, ${primitive.filename ?? '(filename unavailable)'}, x=${primitive.x}, y=${primitive.y}, w=${primitive.width}, h=${primitive.height}, rot=${primitive.rotation}, mirror=${String(primitive.mirror)}, ${primitive.blobReference ?? '(blob unavailable)'}`,
			).join('\n')
		: 'No image OBJ primitives were detected.';

	const recoveredCount = blobRecoveryResults.filter(result => result.recovered).length;
	const saveLine = saveResult.method === 'save-dialog'
		? `JSON save dialog completed.\nFilename:\n${saveResult.path}\n\nThe file is wherever you selected in the save dialog.`
		: `JSON save failed:\n${saveResult.error ?? 'Unknown error'}`;

	const blobLine = recoveredCount > 0
		? `Recovered ${recoveredCount} PNG/image file(s).`
		: 'PNG bytes were not recovered. The extension can see blob references, but no documented EasyEDA API in this run resolved blob:<hash> to image bytes.';
	const warningLine = warnings.length > 0
		? `\n\nWarnings:\n${warnings.join('\n')}`
		: '';

	showInfo(
		`Detected ${imagePrimitives.length} image primitive(s).\n\n${primitiveLines}\n\n${saveLine}\n\n${blobLine}${warningLine}`,
		'Export PCB Image Primitive Info',
	);

	if (saveResult.method === 'save-dialog') {
		showToast(`BetterExport complete: saved ${saveResult.path}`, 'success', 8000);
	}
}

function showInfo(content: string, title: string): void {
	if (eda.sys_Dialog?.showInformationMessage) {
		eda.sys_Dialog.showInformationMessage(content, title, 'OK');
		return;
	}

	eda.sys_MessageBox.showInformationMessage(content, title, 'OK');
}

function showToast(message: string, messageType: 'info' | 'success' | 'warning' | 'error', timer: number): void {
	try {
		if (eda.sys_Message?.showToastMessage) {
			eda.sys_Message.showToastMessage(message, messageType as eda.ESYS_ToastMessageType, timer);
			return;
		}

		if (eda.sys_ToastMessage?.showMessage) {
			eda.sys_ToastMessage.showMessage(message, messageType as eda.ESYS_ToastMessageType, timer);
		}
	}
	catch {
		// Toasts are helpful, but export behavior should never depend on them.
	}
}

function toNumber(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
}

function toBoolean(value: unknown): boolean {
	if (typeof value === 'boolean') {
		return value;
	}

	if (typeof value === 'number') {
		return value !== 0;
	}

	if (typeof value === 'string') {
		return value === '1' || value.toLowerCase() === 'true';
	}

	return false;
}

function summarizeText(value: string, maxLength: number): string {
	if (value.length <= maxLength) {
		return value;
	}

	const headLength = Math.floor(maxLength * 0.7);
	const tailLength = maxLength - headLength;
	return `${value.slice(0, headLength)}\n...[truncated ${value.length - maxLength} chars]...\n${value.slice(-tailLength)}`;
}

function sanitizeFileNamePart(value: string): string {
	return value.replace(/[^\w.-]/g, '_');
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
