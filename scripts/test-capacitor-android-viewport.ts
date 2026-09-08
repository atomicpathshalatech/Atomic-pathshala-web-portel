import assert from "assert";
import fs from "fs";
import path from "path";

async function runCapacitorAndroidViewportTests() {
  console.log("==================================================================");
  console.log("ATOMIC PATHSHALA — CAPACITOR ANDROID & FULL VIEWPORT TEST SUITE");
  console.log("==================================================================\n");

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res
          .then(() => {
            console.log(`  [PASS] #${total}: ${name}`);
            passed++;
          })
          .catch((err) => {
            console.error(`  [FAIL] #${total}: ${name}`);
            console.error("        ", err.message || err);
          });
      } else {
        console.log(`  [PASS] #${total}: ${name}`);
        passed++;
      }
    } catch (err: any) {
      console.error(`  [FAIL] #${total}: ${name}`);
      console.error("        ", err.message || err);
    }
  }

  // 1. Next.js Viewport Metadata Test
  test("Next.js viewport config enforces device-width, cover fit, and interactiveWidget resize", () => {
    const layoutPath = path.resolve(__dirname, "../src/app/layout.tsx");
    const layoutContent = fs.readFileSync(layoutPath, "utf-8");

    assert.ok(layoutContent.includes('width: "device-width"'), "Viewport must specify device-width");
    assert.ok(layoutContent.includes('viewportFit: "cover"'), "Viewport must specify viewportFit cover");
    assert.ok(
      layoutContent.includes('interactiveWidget: "resizes-content"'),
      "Viewport must specify interactiveWidget resizes-content for software keyboard"
    );
  });

  // 2. CSS Base Layer: Root, HTML, and Body Full-Width & Dynamic Viewport Height
  test("globals.css sets html and body to 100% width and 100dvh min-height with zero margin", () => {
    const cssPath = path.resolve(__dirname, "../src/app/globals.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    assert.ok(cssContent.includes("min-height: 100dvh;"), "Must declare 100dvh min-height");
    assert.ok(cssContent.includes("width: 100%;"), "Must declare 100% width on html and body");
    assert.ok(cssContent.includes("--sat: env(safe-area-inset-top, 0px);"), "Must declare --sat safe area top");
    assert.ok(cssContent.includes("--sab: env(safe-area-inset-bottom, 0px);"), "Must declare --sab safe area bottom");
    assert.ok(cssContent.includes("--sal: env(safe-area-inset-left, 0px);"), "Must declare --sal safe area left");
    assert.ok(cssContent.includes("--sar: env(safe-area-inset-right, 0px);"), "Must declare --sar safe area right");
  });

  // 3. Safe Area Inset Utility Classes
  test("globals.css exposes .pt-safe, .pb-safe, .pl-safe, .pr-safe, and .p-safe utility classes", () => {
    const cssPath = path.resolve(__dirname, "../src/app/globals.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    assert.ok(cssContent.includes(".pt-safe"), "Must include .pt-safe utility");
    assert.ok(cssContent.includes(".pb-safe"), "Must include .pb-safe utility");
    assert.ok(cssContent.includes(".pl-safe"), "Must include .pl-safe utility");
    assert.ok(cssContent.includes(".pr-safe"), "Must include .pr-safe utility");
    assert.ok(cssContent.includes(".p-safe"), "Must include .p-safe utility");
  });

  // 4. Live Class Shell Grid: Full Widescreen and 100dvh Viewport Support
  test("Live class shell grid utilizes 100% width, max-width 100vw, and 100dvh without clipping", () => {
    const cssPath = path.resolve(__dirname, "../src/app/globals.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    assert.ok(cssContent.includes(".live-shell"), "Must contain .live-shell declaration");
    assert.ok(cssContent.includes("height: 100dvh;"), ".live-shell must declare 100dvh");
    assert.ok(cssContent.includes("max-width: 100vw;"), ".live-shell must declare max-width 100vw");
  });

  // 5. Student Live Classroom Responsive Layout
  test("StudentLiveClassRoom uses w-full h-full h-screen-safe and landscape:flex-row on mobile", () => {
    const studentRoomPath = path.resolve(__dirname, "../src/components/live-class/StudentLiveClassRoom.tsx");
    const roomContent = fs.readFileSync(studentRoomPath, "utf-8");

    assert.ok(roomContent.includes("w-full h-full h-screen-safe"), "Must use w-full h-full h-screen-safe");
    assert.ok(roomContent.includes("landscape:flex-row"), "Must adapt mobile layout with landscape:flex-row");
    assert.ok(!roomContent.includes("w-screen h-[100dvh]"), "Must NOT use rigid w-screen which causes horizontal overflow");
  });

  // 6. Teacher Live Classroom Fullscreen Container
  test("TeacherLiveClassRoom fixed container is bound to full viewport inset-0", () => {
    const teacherRoomPath = path.resolve(__dirname, "../src/components/live-class/TeacherLiveClassRoom.tsx");
    const roomContent = fs.readFileSync(teacherRoomPath, "utf-8");

    assert.ok(roomContent.includes('className="live-shell fixed inset-0'), "Must bind to fixed inset-0");
  });

  // 7. Capacitor Configuration & Android WebView Settings
  test("capacitor.config.ts configures dark background, keyboard resize, and status bar", () => {
    const capConfigPath = path.resolve(__dirname, "../capacitor.config.ts");
    const capContent = fs.readFileSync(capConfigPath, "utf-8");

    assert.ok(capContent.includes("backgroundColor: '#090D16'"), "Must set dark background color");
    assert.ok(capContent.includes("resize: 'body'"), "Must configure body keyboard resize");
    assert.ok(capContent.includes("resizeOnFullScreen: true"), "Must enable keyboard resize on fullscreen");
  });

  // 8. Android Native Theme & Window Decor
  test("styles.xml configures windowBackground, status bar color, and windowDrawsSystemBarBackgrounds", () => {
    const stylesPath = path.resolve(__dirname, "../android/app/src/main/res/values/styles.xml");
    const stylesContent = fs.readFileSync(stylesPath, "utf-8");

    assert.ok(stylesContent.includes("@color/windowBackground"), "Must declare windowBackground");
    assert.ok(stylesContent.includes("android:statusBarColor"), "Must declare statusBarColor");
    assert.ok(stylesContent.includes("android:navigationBarColor"), "Must declare navigationBarColor");
    assert.ok(stylesContent.includes("android:windowDrawsSystemBarBackgrounds"), "Must declare windowDrawsSystemBarBackgrounds");
  });

  // 9. FloatingGuruWidget exclusion on Live Class
  test("FloatingGuruWidget is hidden on Live Class routes to prevent obscuring whiteboard / controls", () => {
    const widgetPath = path.resolve(__dirname, "../src/components/shared/FloatingGuruWidget.tsx");
    const widgetContent = fs.readFileSync(widgetPath, "utf-8");

    assert.ok(widgetContent.includes('pathname?.includes("/live-class")'), "Must exclude live-class routes");
  });

  console.log(`\nResults: ${passed} / ${total} tests passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runCapacitorAndroidViewportTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
