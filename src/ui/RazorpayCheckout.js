import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

/**
 * Opens Razorpay Checkout.js inside a WebView and posts success / fail / dismiss
 * back to React Native via window.ReactNativeWebView.postMessage.
 */
export default function RazorpayCheckout({ order, methodLabel, onResult }) {
  const html = useMemo(() => {
    const key = order?.keyId || "";
    const amount = Number(order?.amount) || 0;
    const currency = order?.currency || "INR";
    const orderId = order?.id || "";
    const name = order?.prefill?.name || "";
    const email = order?.prefill?.email || "";
    const contact = order?.prefill?.contact || "";
    const methodHint = methodLabel || "UPI";

    const payload = JSON.stringify({
      key,
      amount,
      currency,
      order_id: orderId,
      name: "AquaNest",
      description: `AquaNest · ${methodHint}`,
      image: "https://cdn.razorpay.com/logos/FFATZhWYFDAXnx_medium.png",
      prefill: { name, email, contact },
      theme: { color: "#1B7C98" },
      notes: { method: methodHint },
    });

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    html, body { margin: 0; padding: 0; background: #0f2430; height: 100%; }
    #boot { color: #9fb4bf; font-family: system-ui, sans-serif; text-align: center; padding-top: 40vh; font-size: 14px; }
  </style>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body>
  <div id="boot">Opening Razorpay…</div>
  <script>
    (function () {
      function send(msg) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(msg));
          }
        } catch (e) {}
      }

      var options = ${payload};
      options.handler = function (response) {
        send({
          type: "success",
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature
        });
      };
      options.modal = {
        ondismiss: function () {
          send({ type: "dismiss" });
        }
      };

      try {
        var rzp = new Razorpay(options);
        rzp.on("payment.failed", function (response) {
          var err = (response && response.error) || {};
          send({
            type: "failed",
            code: err.code || "",
            description: err.description || err.reason || "Payment failed"
          });
        });
        rzp.open();
        document.getElementById("boot").textContent = "";
      } catch (e) {
        send({ type: "failed", description: e.message || "Could not open Razorpay" });
      }
    })();
  </script>
</body>
</html>`;
  }, [order, methodLabel]);

  if (!order?.id || !order?.keyId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1B7C98" />
      </View>
    );
  }

  return (
    <WebView
      originWhitelist={["*"]}
      source={{ html, baseUrl: "https://api.razorpay.com" }}
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          onResult?.(data);
        } catch {
          onResult?.({ type: "failed", description: "Invalid payment response" });
        }
      }}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState
      style={styles.webview}
      setSupportMultipleWindows={false}
    />
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: "#0f2430", minHeight: 420 },
  center: { minHeight: 220, alignItems: "center", justifyContent: "center" },
});
