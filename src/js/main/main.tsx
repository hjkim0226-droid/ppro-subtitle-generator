import { useEffect, useState, useRef, useCallback } from "react";
import { subscribeBackgroundColor, evalTS } from "../lib/utils/bolt";
import { fs, path } from "../lib/cep/node";
import "./main.scss";

// Buffer from Node.js (CEP environment)
const getBuffer = () => {
  if (typeof window !== "undefined" && (window as any).cep) {
    return require("buffer").Buffer;
  }
  return null;
};

// 드래그로 값 조정하는 컴포넌트
interface DragNumberProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

const DragNumber: React.FC<DragNumberProps> = ({ value, onChange, min = -999, max = 999, step = 1 }) => {
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startValue = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startX.current = e.clientX;
    startValue.current = value;
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const diff = e.clientX - startX.current;

      // Ctrl = 세밀 조정 (0.1배), Shift = 큰 조정 (10배)
      let multiplier = step;
      if (e.ctrlKey || e.metaKey) multiplier = step * 0.1;
      if (e.shiftKey) multiplier = step * 10;

      const newValue = Math.round(startValue.current + diff * multiplier);
      const clamped = Math.max(min, Math.min(max, newValue));
      onChange(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, min, max, step, onChange]);

  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
      onMouseDown={handleMouseDown}
      className="drag-number"
    />
  );
};

// ===== Types =====
interface SubtitleStyle {
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  letterSpacing: number;
  textColor: string;
  bgColor: string;
  bgOpacity: number;
  paddingV: number;
  paddingH: number;
  borderRadius: number;
  textOffsetY: number;  // 텍스트 Y 오프셋
}

interface PositionPreset {
  x: number;
  y: number;
  name?: string;
}

interface OutputSettings {
  savePath: string;
  filePrefix: string;
  currentNumber: number;
}

// ===== Default Values =====
// 폰트 목록
const FONT_OPTIONS = [
  { value: "Pretendard", label: "Pretendard" },
  { value: "Noto Sans KR", label: "Noto Sans KR" },
  { value: "Spoqa Han Sans Neo", label: "스포카 한 산스" },
  { value: "NanumGothic", label: "나눔고딕" },
  { value: "NanumSquare", label: "나눔스퀘어" },
];

const DEFAULT_STYLE: SubtitleStyle = {
  fontFamily: "Pretendard",
  fontWeight: "700",
  fontSize: 48,
  letterSpacing: -1,
  textColor: "#FFFFFF",
  bgColor: "#000000",
  bgOpacity: 70,
  paddingV: 16,
  paddingH: 24,
  borderRadius: 8,
  textOffsetY: 0,
};

const DEFAULT_OUTPUT: OutputSettings = {
  savePath: "",
  filePrefix: "sub_",
  currentNumber: 1,
};

// ===== Helper Functions =====
const hexToRgba = (hex: string, opacity: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
};

const getNextFileNumber = (directory: string, prefix: string): number => {
  if (!fs.existsSync(directory)) return 1;

  const files = fs.readdirSync(directory);
  let maxNum = 0;

  files.forEach((file: string) => {
    if (file.startsWith(prefix) && file.endsWith(".png")) {
      const numStr = file.replace(prefix, "").replace(".png", "");
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  return maxNum + 1;
};

// ===== Main App =====
export const App = () => {
  const [bgColor, setBgColor] = useState("#282c34");
  const [text, setText] = useState("");
  const [lastText, setLastText] = useState("");  // Undo용
  const [style, setStyle] = useState<SubtitleStyle>(DEFAULT_STYLE);
  const [output, setOutput] = useState<OutputSettings>(DEFAULT_OUTPUT);
  const [presets, setPresets] = useState<(PositionPreset | null)[]>(Array(9).fill(null));
  const [presetMode, setPresetMode] = useState<"none" | "save">("none");
  const [status, setStatus] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"subtitle" | "position">("subtitle");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Undo 기능 (Ctrl+Z)
  const handleUndo = useCallback(() => {
    if (lastText) {
      setText(lastText);
      setLastText("");
      setStatus("텍스트 복구됨");
    }
  }, [lastText]);

  // Load saved settings + keyboard shortcuts
  useEffect(() => {
    if (window.cep) {
      subscribeBackgroundColor(setBgColor);
    }

    const savedStyle = localStorage.getItem("subtitle-style");
    const savedOutput = localStorage.getItem("subtitle-output");
    const savedPresets = localStorage.getItem("position-presets");

    if (savedStyle) setStyle(JSON.parse(savedStyle));
    if (savedOutput) setOutput(JSON.parse(savedOutput));
    if (savedPresets) setPresets(JSON.parse(savedPresets));

    // Keyboard shortcut for undo
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo]);

  // Save settings
  useEffect(() => {
    localStorage.setItem("subtitle-style", JSON.stringify(style));
  }, [style]);

  useEffect(() => {
    localStorage.setItem("subtitle-output", JSON.stringify(output));
  }, [output]);

  useEffect(() => {
    localStorage.setItem("position-presets", JSON.stringify(presets));
  }, [presets]);

  // Update preview
  const updatePreview = useCallback(async () => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !text) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 폰트 로드 대기
    try {
      await document.fonts.load(`${style.fontWeight} ${style.fontSize}px "${style.fontFamily}"`);
    } catch (e) {
      console.log("Font load warning:", e);
    }

    // Set font
    ctx.font = `${style.fontWeight} ${style.fontSize}px "${style.fontFamily}"`;

    // Measure text
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = style.fontSize;

    // Calculate canvas size
    const width = textWidth + style.paddingH * 2;
    const height = textHeight + style.paddingV * 2;

    canvas.width = width;
    canvas.height = height;

    // Reset font after resize
    ctx.font = `${style.fontWeight} ${style.fontSize}px "${style.fontFamily}"`;

    // Draw background
    ctx.fillStyle = hexToRgba(style.bgColor, style.bgOpacity);
    if (style.borderRadius > 0) {
      ctx.beginPath();
      ctx.roundRect(0, 0, width, height, style.borderRadius);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, width, height);
    }

    // Draw text
    ctx.fillStyle = style.textColor;
    ctx.textBaseline = "middle";
    ctx.letterSpacing = `${style.letterSpacing}px`;
    ctx.fillText(text, style.paddingH, height / 2 + style.textOffsetY);
  }, [text, style]);

  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  // Generate PNG
  const generatePNG = async () => {
    console.log("generatePNG called");

    if (!text.trim()) {
      setStatus("텍스트를 입력하세요");
      return;
    }

    if (!output.savePath) {
      setStatus("저장 경로를 선택하세요");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      console.log("canvas is null");
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.log("ctx is null");
      return;
    }

    console.log("Buffer:", getBuffer());
    console.log("fs:", fs);
    console.log("path:", path);

    setStatus("생성 중...");

    try {
      // 폰트 로드 대기
      try {
        await document.fonts.load(`${style.fontWeight} ${style.fontSize}px "${style.fontFamily}"`);
      } catch (e) {
        console.log("Font load warning:", e);
      }

      // Set font
      ctx.font = `${style.fontWeight} ${style.fontSize}px "${style.fontFamily}"`;

      // Measure text
      const metrics = ctx.measureText(text);
      const textWidth = metrics.width;
      const textHeight = style.fontSize;

      // Calculate canvas size
      const width = textWidth + style.paddingH * 2;
      const height = textHeight + style.paddingV * 2;

      canvas.width = width;
      canvas.height = height;

      // Reset font after resize
      ctx.font = `${style.fontWeight} ${style.fontSize}px "${style.fontFamily}"`;

      // Draw background
      ctx.fillStyle = hexToRgba(style.bgColor, style.bgOpacity);
      if (style.borderRadius > 0) {
        ctx.beginPath();
        ctx.roundRect(0, 0, width, height, style.borderRadius);
        ctx.fill();
      } else {
        ctx.fillRect(0, 0, width, height);
      }

      // Draw text
      ctx.fillStyle = style.textColor;
      ctx.textBaseline = "middle";
      ctx.letterSpacing = `${style.letterSpacing}px`;
      ctx.fillText(text, style.paddingH, height / 2 + style.textOffsetY);

      // Get data URL and save
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");

      // Generate filename
      const fileNum = output.currentNumber.toString().padStart(3, "0");
      const fileName = `${output.filePrefix}${fileNum}.png`;
      const filePath = path.join(output.savePath, fileName);

      // Save file
      const BufferClass = getBuffer();
      if (!BufferClass) {
        setStatus("Buffer 로드 실패");
        return;
      }
      const fileBuffer = BufferClass.from(base64, "base64");
      fs.writeFileSync(filePath, fileBuffer);

      // Import to Premiere Pro
      await evalTS("importFile", filePath);

      // Update number
      setOutput(prev => ({ ...prev, currentNumber: prev.currentNumber + 1 }));

      setStatus(`생성 완료: ${fileName}`);
      setLastText(text);  // Undo용 저장
      setText(""); // Clear text after generation

    } catch (error: any) {
      setStatus(`오류: ${error.message}`);
    }
  };

  // Handle preset click
  const handlePresetClick = async (index: number) => {
    if (presetMode === "save") {
      // Save current clip position to preset
      try {
        const pos = await evalTS("getSelectedClipPosition");
        if (pos) {
          const newPresets = [...presets];
          newPresets[index] = { x: pos.x, y: pos.y, name: `Preset ${index + 1}` };
          setPresets(newPresets);
          setStatus(`프리셋 ${index + 1}에 저장됨`);
        } else {
          setStatus("클립을 선택하세요");
        }
      } catch (error) {
        setStatus("위치 가져오기 실패");
      }
      setPresetMode("none");
    } else {
      // Apply preset directly
      const preset = presets[index];
      if (preset) {
        try {
          await evalTS("setSelectedClipPosition", preset.x, preset.y);
          setStatus(`프리셋 ${index + 1} 적용됨`);
        } catch (error) {
          setStatus("위치 적용 실패");
        }
      } else {
        setStatus("저장된 프리셋 없음");
      }
    }
  };

  // Select folder
  const selectFolder = () => {
    try {
      // @ts-ignore
      const csi = new CSInterface();
      const result = csi.evalScript('Folder.selectDialog("저장 폴더 선택")', (res: string) => {
        if (res && res !== "null" && res !== "") {
          // ExtendScript returns path with ~ prefix sometimes
          const selectedPath = res.replace(/^~/, process.env.HOME || "");
          const nextNum = getNextFileNumber(selectedPath, output.filePrefix);
          setOutput(prev => ({ ...prev, savePath: selectedPath, currentNumber: nextNum }));
        }
      });
    } catch (e) {
      console.error("Folder selection error:", e);
    }
  };

  return (
    <div className="app" style={{ backgroundColor: bgColor }}>
      <div className="container">
        <header className="header">
          <h1>🎬 자막 생성기</h1>
        </header>

        {/* Tab Navigation */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === "subtitle" ? "active" : ""}`}
            onClick={() => setActiveTab("subtitle")}
          >
            자막 생성
          </button>
          <button
            className={`tab ${activeTab === "position" ? "active" : ""}`}
            onClick={() => setActiveTab("position")}
          >
            포지션 프리셋
          </button>
        </div>

        {activeTab === "subtitle" && (
          <>
            {/* Text Input */}
            <section className="section">
              <label>텍스트</label>
              <input
                type="text"
                className="text-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="자막 텍스트 입력..."
                onKeyDown={(e) => e.key === "Enter" && generatePNG()}
              />
            </section>

            {/* Style Settings */}
            <section className="section">
              <h3>스타일 설정</h3>

              <div className="style-grid">
                <div className="style-row">
                  <label>폰트</label>
                  <select
                    value={style.fontFamily}
                    onChange={(e) => setStyle(s => ({ ...s, fontFamily: e.target.value }))}
                  >
                    {FONT_OPTIONS.map(font => (
                      <option key={font.value} value={font.value}>{font.label}</option>
                    ))}
                  </select>
                </div>

                <div className="style-row">
                  <label>굵기</label>
                  <select
                    value={style.fontWeight}
                    onChange={(e) => setStyle(s => ({ ...s, fontWeight: e.target.value }))}
                  >
                    <option value="400">Regular</option>
                    <option value="500">Medium</option>
                    <option value="600">SemiBold</option>
                    <option value="700">Bold</option>
                    <option value="800">ExtraBold</option>
                  </select>
                </div>

                <div className="style-row">
                  <label>폰트 크기</label>
                  <DragNumber
                    value={style.fontSize}
                    onChange={(v) => setStyle(s => ({ ...s, fontSize: v }))}
                    min={8}
                    max={200}
                  />
                </div>

                <div className="style-row">
                  <label>자간</label>
                  <DragNumber
                    value={style.letterSpacing}
                    onChange={(v) => setStyle(s => ({ ...s, letterSpacing: v }))}
                    min={-20}
                    max={50}
                  />
                </div>

                <div className="style-row">
                  <label>텍스트 색상</label>
                  <input
                    type="color"
                    value={style.textColor}
                    onChange={(e) => setStyle(s => ({ ...s, textColor: e.target.value }))}
                  />
                </div>

                <div className="style-row">
                  <label>배경 색상</label>
                  <input
                    type="color"
                    value={style.bgColor}
                    onChange={(e) => setStyle(s => ({ ...s, bgColor: e.target.value }))}
                  />
                </div>

                <div className="style-row">
                  <label>배경 투명도</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={style.bgOpacity}
                    onChange={(e) => setStyle(s => ({ ...s, bgOpacity: parseInt(e.target.value) }))}
                  />
                  <span>{style.bgOpacity}%</span>
                </div>

                <div className="style-row">
                  <label>패딩 (상하)</label>
                  <DragNumber
                    value={style.paddingV}
                    onChange={(v) => setStyle(s => ({ ...s, paddingV: v }))}
                    min={0}
                    max={100}
                  />
                </div>

                <div className="style-row">
                  <label>패딩 (좌우)</label>
                  <DragNumber
                    value={style.paddingH}
                    onChange={(v) => setStyle(s => ({ ...s, paddingH: v }))}
                    min={0}
                    max={100}
                  />
                </div>

                <div className="style-row">
                  <label>모서리</label>
                  <DragNumber
                    value={style.borderRadius}
                    onChange={(v) => setStyle(s => ({ ...s, borderRadius: v }))}
                    min={0}
                    max={50}
                  />
                </div>

                <div className="style-row">
                  <label>텍스트 Y 오프셋</label>
                  <DragNumber
                    value={style.textOffsetY}
                    onChange={(v) => setStyle(s => ({ ...s, textOffsetY: v }))}
                    min={-50}
                    max={50}
                  />
                </div>
              </div>
            </section>

            {/* Output Settings */}
            <section className="section">
              <h3>출력 설정</h3>

              <div className="output-row">
                <label>저장 경로</label>
                <div className="path-input">
                  <input
                    type="text"
                    value={output.savePath}
                    readOnly
                    placeholder="폴더 선택..."
                  />
                  <button onClick={selectFolder}>📁</button>
                </div>
              </div>

              <div className="output-row">
                <label>파일명 접두사</label>
                <input
                  type="text"
                  value={output.filePrefix}
                  onChange={(e) => setOutput(o => ({ ...o, filePrefix: e.target.value }))}
                />
              </div>

              <div className="output-row">
                <label>다음 번호</label>
                <input
                  type="number"
                  value={output.currentNumber}
                  onChange={(e) => setOutput(o => ({ ...o, currentNumber: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </section>

            {/* Preview */}
            <section className="section preview-section">
              <h3>미리보기</h3>
              <div className="preview-container">
                <canvas ref={previewCanvasRef} className="preview-canvas" />
              </div>
            </section>

            {/* Generate Button */}
            <button className="btn-generate" onClick={generatePNG}>
              생성
            </button>
          </>
        )}

        {activeTab === "position" && (
          <section className="section position-section">
            <h3>📍 포지션 프리셋</h3>

            <div className="preset-grid">
              {presets.map((preset, index) => (
                <button
                  key={index}
                  className={`preset-btn ${preset ? "has-data" : ""} ${presetMode !== "none" ? "active-mode" : ""}`}
                  onClick={() => handlePresetClick(index)}
                >
                  {index + 1}
                  {preset && <span className="preset-indicator">●</span>}
                </button>
              ))}
            </div>

            <div className="preset-actions">
              <button
                className={`mode-btn ${presetMode === "save" ? "active" : ""}`}
                onClick={() => setPresetMode(presetMode === "save" ? "none" : "save")}
              >
                저장
              </button>
            </div>

            <p className="preset-hint">
              {presetMode === "save" && "프리셋 버튼을 클릭하면 현재 클립 위치가 저장됩니다"}
              {presetMode === "none" && "프리셋 클릭 → 적용 / [저장] 클릭 후 프리셋 클릭 → 저장"}
            </p>
          </section>
        )}

        {/* Status */}
        {status && <div className="status">{status}</div>}

        {/* Hidden canvas for PNG generation */}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </div>
  );
};
