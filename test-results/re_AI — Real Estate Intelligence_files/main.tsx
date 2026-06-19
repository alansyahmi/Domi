import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/main.tsx");const React = __vite__cjsImport0_react; const useEffect = __vite__cjsImport0_react["useEffect"]; const useState = __vite__cjsImport0_react["useState"];const ReactDOM = __vite__cjsImport1_reactDom_client;const _jsxDEV = __vite__cjsImport6_react_jsxDevRuntime["jsxDEV"];import __vite__cjsImport0_react from "/node_modules/.vite/deps/react.js?v=02f89c37";
import __vite__cjsImport1_reactDom_client from "/node_modules/.vite/deps/react-dom_client.js?v=02f89c37";
import { BrowserRouter } from "/node_modules/.vite/deps/react-router-dom.js?v=02f89c37";
import App from "/src/App.tsx?t=1781827578717";
import { fetchAuthConfig, resolveAuthModeFromConfig } from "/src/lib/auth-mode.ts";
import "/src/styles.css?t=1781827624170";
var _jsxFileName = "C:/Projects/Domi/src/main.tsx";
import __vite__cjsImport6_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=02f89c37";
var _s = $RefreshSig$();
const faviconUrl = new URL("/favicon.png", '' + import.meta.url).href;
function Root() {
	_s();
	const [authMode, setAuthMode] = useState(null);
	useEffect(() => {
		fetchAuthConfig().then(resolveAuthModeFromConfig).then(setAuthMode).catch(() => setAuthMode("demo"));
	}, []);
	if (authMode === null) {
		return /* @__PURE__ */ _jsxDEV("main", {
			className: "min-h-screen grid place-items-center bg-[#272727] text-white",
			children: /* @__PURE__ */ _jsxDEV("div", {
				className: "card p-10 text-center max-w-sm w-full mx-4 border border-white/10 bg-white/5 text-white shadow-2xl",
				children: /* @__PURE__ */ _jsxDEV("div", {
					className: "hci-loader-container",
					children: [/* @__PURE__ */ _jsxDEV("div", {
						className: "hci-loader-logo",
						children: /* @__PURE__ */ _jsxDEV("img", {
							src: faviconUrl,
							alt: "",
							"aria-hidden": "true",
							className: "hci-loader-logo-image"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 30,
							columnNumber: 15
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 29,
						columnNumber: 13
					}, this), /* @__PURE__ */ _jsxDEV("div", { children: [/* @__PURE__ */ _jsxDEV("p", {
						className: "text-slate-200 font-bold m-0",
						children: "Loading re:AI workspace..."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 33,
						columnNumber: 15
					}, this), /* @__PURE__ */ _jsxDEV("div", { className: "hci-loading-bar" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 34,
						columnNumber: 15
					}, this)] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 32,
						columnNumber: 13
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 28,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 27,
				columnNumber: 9
			}, this)
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 26,
			columnNumber: 7
		}, this);
	}
	return /* @__PURE__ */ _jsxDEV(App, { authMode }, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 42,
		columnNumber: 10
	}, this);
}
_s(Root, "y0U+K9z14Xw3jk51wSQI7awGstY=");
_c = Root;
ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ _jsxDEV(React.StrictMode, { children: /* @__PURE__ */ _jsxDEV(BrowserRouter, { children: /* @__PURE__ */ _jsxDEV(Root, {}, void 0, false, {
	fileName: _jsxFileName,
	lineNumber: 48,
	columnNumber: 7
}, this) }, void 0, false, {
	fileName: _jsxFileName,
	lineNumber: 47,
	columnNumber: 5
}, this) }, void 0, false, {
	fileName: _jsxFileName,
	lineNumber: 46,
	columnNumber: 3
}, this));
var _c;
$RefreshReg$(_c, "Root");
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
import * as __vite_react_currentExports from "/src/main.tsx?t=1781827624170";
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }

  const currentExports = __vite_react_currentExports;
  queueMicrotask(() => {
    RefreshRuntime.registerExportsForReactRefresh("C:/Projects/Domi/src/main.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("C:/Projects/Domi/src/main.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
function $RefreshReg$(type, id) { return RefreshRuntime.register(type, "C:/Projects/Domi/src/main.tsx" + ' ' + id); }
function $RefreshSig$() { return RefreshRuntime.createSignatureFunctionForTransform(); }

//# sourceMappingURL=data:application/json;base64,eyJtYXBwaW5ncyI6IkFBQUEsT0FBTyxTQUFTLFdBQVcsZ0JBQWdCO0FBQzNDLE9BQU8sY0FBYztBQUNyQixTQUFTLHFCQUFxQjtBQUM5QixPQUFPLFNBQVM7QUFDaEIsU0FFRSxpQkFDQSxpQ0FDSztBQUNQLE9BQU87Ozs7QUFFUCxNQUFNLGFBQWEsSUFBSSxJQUFJLGtCQUFrQixPQUFPLEtBQUssR0FBRyxFQUFFO0FBRTlELFNBQVMsT0FBTzs7Q0FDZCxNQUFNLENBQUMsVUFBVSxlQUFlLFNBQWtDLElBQUk7Q0FFdEUsZ0JBQWdCO0VBQ2QsZ0JBQWdCLEVBQ2IsS0FBSyx5QkFBeUIsRUFDOUIsS0FBSyxXQUFXLEVBQ2hCLFlBQVksWUFBWSxNQUFNLENBQUM7Q0FDcEMsR0FBRyxDQUFDLENBQUM7Q0FFTCxJQUFJLGFBQWEsTUFBTTtFQUNyQixPQUNFLHdCQUFDLFFBQUQ7R0FBTSxXQUFVO2FBQ2Qsd0JBQUMsT0FBRDtJQUFLLFdBQVU7Y0FDYix3QkFBQyxPQUFEO0tBQUssV0FBVTtlQUFmLENBQ0Usd0JBQUMsT0FBRDtNQUFLLFdBQVU7Z0JBQ2Isd0JBQUMsT0FBRDtPQUFLLEtBQUs7T0FBWSxLQUFJO09BQUcsZUFBWTtPQUFPLFdBQVU7TUFBeUI7Ozs7O0tBQ2hGOzs7O2VBQ0wsd0JBQUMsT0FBRCxhQUNFLHdCQUFDLEtBQUQ7TUFBRyxXQUFVO2dCQUErQjtLQUE2Qjs7OztlQUN6RSx3QkFBQyxPQUFELEVBQUssV0FBVSxrQkFBbUI7Ozs7YUFDL0I7Ozs7YUFDRjs7Ozs7O0dBQ0Y7Ozs7O0VBQ0Q7Ozs7O0NBRVY7Q0FFQSxPQUFPLHdCQUFDLEtBQUQsRUFBZSxTQUFXOzs7OztBQUNuQzs7O0FBRUEsU0FBUyxXQUFXLFNBQVMsZUFBZSxNQUFNLENBQUUsRUFBRSxPQUNwRCx3QkFBQyxNQUFNLFlBQVAsWUFDRSx3QkFBQyxlQUFELFlBQ0Usd0JBQUMsTUFBRCxDQUFPOzs7O1NBQ007Ozs7U0FDQzs7OztRQUNwQiIsIm5hbWVzIjpbXSwic291cmNlcyI6WyJtYWluLnRzeCJdLCJ2ZXJzaW9uIjozLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUmVhY3QsIHsgdXNlRWZmZWN0LCB1c2VTdGF0ZSB9IGZyb20gXCJyZWFjdFwiO1xyXG5pbXBvcnQgUmVhY3RET00gZnJvbSBcInJlYWN0LWRvbS9jbGllbnRcIjtcbmltcG9ydCB7IEJyb3dzZXJSb3V0ZXIgfSBmcm9tIFwicmVhY3Qtcm91dGVyLWRvbVwiO1xuaW1wb3J0IEFwcCBmcm9tIFwiLi9BcHBcIjtcbmltcG9ydCB7XG4gIHR5cGUgU2lnbmF0aXNBdXRoTW9kZSxcbiAgZmV0Y2hBdXRoQ29uZmlnLFxyXG4gIHJlc29sdmVBdXRoTW9kZUZyb21Db25maWcsXHJcbn0gZnJvbSBcIi4vbGliL2F1dGgtbW9kZVwiO1xyXG5pbXBvcnQgXCIuL3N0eWxlcy5jc3NcIjtcblxuY29uc3QgZmF2aWNvblVybCA9IG5ldyBVUkwoXCIuLi9mYXZpY29uLnBuZ1wiLCBpbXBvcnQubWV0YS51cmwpLmhyZWY7XG5cclxuZnVuY3Rpb24gUm9vdCgpIHtcclxuICBjb25zdCBbYXV0aE1vZGUsIHNldEF1dGhNb2RlXSA9IHVzZVN0YXRlPFNpZ25hdGlzQXV0aE1vZGUgfCBudWxsPihudWxsKTtcclxuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGZldGNoQXV0aENvbmZpZygpXHJcbiAgICAgIC50aGVuKHJlc29sdmVBdXRoTW9kZUZyb21Db25maWcpXHJcbiAgICAgIC50aGVuKHNldEF1dGhNb2RlKVxyXG4gICAgICAuY2F0Y2goKCkgPT4gc2V0QXV0aE1vZGUoXCJkZW1vXCIpKTtcclxuICB9LCBbXSk7XHJcblxyXG4gIGlmIChhdXRoTW9kZSA9PT0gbnVsbCkge1xuICAgIHJldHVybiAoXG4gICAgICA8bWFpbiBjbGFzc05hbWU9XCJtaW4taC1zY3JlZW4gZ3JpZCBwbGFjZS1pdGVtcy1jZW50ZXIgYmctWyMyNzI3MjddIHRleHQtd2hpdGVcIj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJjYXJkIHAtMTAgdGV4dC1jZW50ZXIgbWF4LXctc20gdy1mdWxsIG14LTQgYm9yZGVyIGJvcmRlci13aGl0ZS8xMCBiZy13aGl0ZS81IHRleHQtd2hpdGUgc2hhZG93LTJ4bFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaGNpLWxvYWRlci1jb250YWluZXJcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaGNpLWxvYWRlci1sb2dvXCI+XG4gICAgICAgICAgICAgIDxpbWcgc3JjPXtmYXZpY29uVXJsfSBhbHQ9XCJcIiBhcmlhLWhpZGRlbj1cInRydWVcIiBjbGFzc05hbWU9XCJoY2ktbG9hZGVyLWxvZ28taW1hZ2VcIiAvPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNsYXRlLTIwMCBmb250LWJvbGQgbS0wXCI+TG9hZGluZyByZTpBSSB3b3Jrc3BhY2UuLi48L3A+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaGNpLWxvYWRpbmctYmFyXCIgLz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvbWFpbj5cbiAgICApO1xuICB9XG5cclxuICByZXR1cm4gPEFwcCBhdXRoTW9kZT17YXV0aE1vZGV9IC8+O1xyXG59XHJcblxyXG5SZWFjdERPTS5jcmVhdGVSb290KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwicm9vdFwiKSEpLnJlbmRlcihcclxuICA8UmVhY3QuU3RyaWN0TW9kZT5cclxuICAgIDxCcm93c2VyUm91dGVyPlxyXG4gICAgICA8Um9vdCAvPlxyXG4gICAgPC9Ccm93c2VyUm91dGVyPlxyXG4gIDwvUmVhY3QuU3RyaWN0TW9kZT4sXHJcbik7XHJcbiJdfQ==