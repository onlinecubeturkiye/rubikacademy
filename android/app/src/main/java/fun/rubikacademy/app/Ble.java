package fun.rubikacademy.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.ParcelUuid;
import android.util.Base64;
import android.util.SparseArray;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * WebView'de Web Bluetooth yok: site (js/common.js) navigator.bluetooth'u bu köprüyle taklit eder.
 * RAAppNative.ble(id, {op: scan|stopScan|connect|disconnect|read|write|notify, ...}) → raAppCb(id, sonuç)
 * Olaylar: window.raBleEv({t: adv|val|disc, ...}). GATT işlemleri sırayla (tek tek) yapılır; hepsi ana iş parçacığında.
 */
@SuppressLint("MissingPermission")
class Ble {
    static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    final MainActivity a;
    final BluetoothAdapter ad;
    final Map<String, BluetoothGatt> gatts = new HashMap<>();
    final Map<String, String> connIds = new HashMap<>();
    final ArrayDeque<Runnable> q = new ArrayDeque<>();
    ScanCallback scb;
    String opId, permId;
    boolean busy;
    Runnable afterPerm;

    Ble(MainActivity a) {
        this.a = a;
        BluetoothManager m = (BluetoothManager) a.getSystemService(Context.BLUETOOTH_SERVICE);
        ad = m == null ? null : m.getAdapter();
    }

    String[] perms() {
        return Build.VERSION.SDK_INT >= 31
                ? new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT}
                : new String[]{Manifest.permission.ACCESS_FINE_LOCATION};
    }
    boolean hasPerms() { for (String p : perms()) if (!a.has(p)) return false; return true; }
    void onPerm() {
        Runnable r = afterPerm; afterPerm = null;
        if (r == null) return;
        if (hasPerms()) r.run(); else a.reply(permId, err("NotAllowedError"));
    }

    static String err(String n) { return "{\"err\":" + JSONObject.quote(n) + "}"; }
    static String b64(byte[] v) { return Base64.encodeToString(v == null ? new byte[0] : v, Base64.NO_WRAP); }
    void ev(JSONObject o) { a.js("window.raBleEv&&window.raBleEv(" + o + ")"); }

    void handle(String id, String arg) {
        a.runOnUiThread(() -> {
            try {
                JSONObject o = new JSONObject(arg);
                String op = o.getString("op");
                if (ad == null) { a.reply(id, err("NotSupportedError")); return; }
                if (!hasPerms()) { afterPerm = () -> handle(id, arg); permId = id; a.requestPermissions(perms(), MainActivity.RQ_BLE); return; }
                if (!ad.isEnabled() && !op.equals("stopScan") && !op.equals("disconnect")) {
                    try { a.startActivity(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)); } catch (Exception e) {}
                    a.reply(id, err("BluetoothOff")); return;
                }
                switch (op) {
                    case "scan": scan(); a.reply(id, "true"); break;
                    case "stopScan": stopScan(); a.reply(id, "true"); break;
                    case "connect": connect(id, o.getString("id")); break;
                    case "disconnect": {
                        BluetoothGatt g = gatts.remove(o.getString("id"));
                        if (g != null) { g.disconnect(); g.close(); }
                        a.reply(id, "true"); break;
                    }
                    default: gattOp(id, o);
                }
            } catch (Exception e) { a.reply(id, err("NetworkError")); }
        });
    }

    void scan() {
        if (scb != null || ad.getBluetoothLeScanner() == null) return;
        scb = new ScanCallback() {
            @Override
            public void onScanResult(int type, ScanResult r) {
                try {
                    BluetoothDevice d = r.getDevice();
                    ScanRecord rec = r.getScanRecord();
                    String n = rec != null && rec.getDeviceName() != null ? rec.getDeviceName() : d.getName();
                    JSONObject o = new JSONObject(), m = new JSONObject();
                    JSONArray su = new JSONArray();
                    if (rec != null) {
                        SparseArray<byte[]> md = rec.getManufacturerSpecificData();
                        if (md != null) for (int i = 0; i < md.size(); i++) m.put(String.valueOf(md.keyAt(i)), b64(md.valueAt(i)));
                        if (rec.getServiceUuids() != null) for (ParcelUuid u : rec.getServiceUuids()) su.put(u.toString());
                    }
                    o.put("t", "adv"); o.put("id", d.getAddress()); o.put("name", n == null ? JSONObject.NULL : n);
                    o.put("rssi", r.getRssi()); o.put("mfr", m); o.put("uuids", su);
                    ev(o);
                } catch (Exception e) {}
            }
        };
        ad.getBluetoothLeScanner().startScan(null, new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), scb);
    }

    void stopScan() {
        if (scb == null) return;
        try { ad.getBluetoothLeScanner().stopScan(scb); } catch (Exception e) {}
        scb = null;
    }

    void connect(String rid, String addr) {
        BluetoothGatt old = gatts.remove(addr);
        if (old != null) old.close();
        connIds.put(addr, rid);
        gatts.put(addr, ad.getRemoteDevice(addr).connectGatt(a, false, cb, BluetoothDevice.TRANSPORT_LE));
    }

    void gattOp(String rid, JSONObject o) throws Exception {
        BluetoothGatt g = gatts.get(o.getString("id"));
        if (g == null) { a.reply(rid, err("NetworkError")); return; }
        BluetoothGattService s = g.getService(UUID.fromString(o.getString("s")));
        BluetoothGattCharacteristic c = s == null ? null : s.getCharacteristic(UUID.fromString(o.getString("c")));
        if (c == null) { a.reply(rid, err("NotFoundError")); return; }
        String op = o.getString("op");
        q.add(() -> {
            opId = rid;
            boolean ok = false;
            if (op.equals("read")) ok = g.readCharacteristic(c);
            else if (op.equals("write")) {
                byte[] v = Base64.decode(o.optString("v"), Base64.DEFAULT);
                int wt = o.optBoolean("nr") ? BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE : BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT;
                if (Build.VERSION.SDK_INT >= 33) ok = g.writeCharacteristic(c, v, wt) == 0;
                else { c.setWriteType(wt); c.setValue(v); ok = g.writeCharacteristic(c); }
            } else if (op.equals("notify")) {
                boolean on = o.optBoolean("on");
                g.setCharacteristicNotification(c, on);
                BluetoothGattDescriptor d = c.getDescriptor(CCCD);
                if (d == null) { done("true"); return; }
                int p = c.getProperties();
                byte[] dv = !on ? BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE
                        : (p & BluetoothGattCharacteristic.PROPERTY_NOTIFY) == 0 ? BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
                        : BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE;
                if (Build.VERSION.SDK_INT >= 33) ok = g.writeDescriptor(d, dv) == 0;
                else { d.setValue(dv); ok = g.writeDescriptor(d); }
            }
            if (!ok) done(err("NetworkError"));
        });
        if (!busy) next();
    }

    void next() { Runnable r = q.poll(); busy = r != null; if (r != null) r.run(); }
    void done(String res) {
        a.runOnUiThread(() -> { String id = opId; opId = null; if (id != null) a.reply(id, res); next(); });
    }

    void val(BluetoothGatt g, BluetoothGattCharacteristic c, byte[] v) {
        try {
            JSONObject o = new JSONObject();
            o.put("t", "val"); o.put("id", g.getDevice().getAddress());
            o.put("s", c.getService().getUuid().toString()); o.put("c", c.getUuid().toString()); o.put("v", b64(v));
            ev(o);
        } catch (Exception e) {}
    }

    final BluetoothGattCallback cb = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt g, int st, int ns) {
            String addr = g.getDevice().getAddress();
            if (ns == BluetoothProfile.STATE_CONNECTED && st == BluetoothGatt.GATT_SUCCESS) { g.discoverServices(); return; }
            if (ns != BluetoothProfile.STATE_DISCONNECTED && st == BluetoothGatt.GATT_SUCCESS) return;
            a.runOnUiThread(() -> {
                String rid = connIds.remove(addr);
                if (rid != null) a.reply(rid, err("NetworkError"));
                if (gatts.get(addr) == g) gatts.remove(addr);
                g.close();
                if (opId != null) done(err("NetworkError"));
                try { JSONObject o = new JSONObject(); o.put("t", "disc"); o.put("id", addr); ev(o); } catch (Exception e) {}
            });
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt g, int st) {
            String rid = connIds.remove(g.getDevice().getAddress());
            if (rid == null) return;
            if (st != BluetoothGatt.GATT_SUCCESS) { a.reply(rid, err("NetworkError")); return; }
            try {
                JSONArray arr = new JSONArray();
                for (BluetoothGattService s : g.getServices()) {
                    JSONArray cs = new JSONArray();
                    for (BluetoothGattCharacteristic c : s.getCharacteristics()) {
                        JSONObject co = new JSONObject(); co.put("uuid", c.getUuid().toString()); co.put("p", c.getProperties()); cs.put(co);
                    }
                    JSONObject so = new JSONObject(); so.put("uuid", s.getUuid().toString()); so.put("c", cs); arr.put(so);
                }
                a.reply(rid, arr.toString());
            } catch (Exception e) { a.reply(rid, err("NetworkError")); }
        }

        // Android 13+ (değer parametreyle gelir)
        @Override
        public void onCharacteristicRead(BluetoothGatt g, BluetoothGattCharacteristic c, byte[] v, int st) {
            done(st == BluetoothGatt.GATT_SUCCESS ? JSONObject.quote(b64(v)) : err("NetworkError"));
        }
        @Override
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic c, byte[] v) { val(g, c, v); }

        // Android 12 ve öncesi
        @SuppressWarnings("deprecation")
        @Override
        public void onCharacteristicRead(BluetoothGatt g, BluetoothGattCharacteristic c, int st) {
            done(st == BluetoothGatt.GATT_SUCCESS ? JSONObject.quote(b64(c.getValue())) : err("NetworkError"));
        }
        @SuppressWarnings("deprecation")
        @Override
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic c) { val(g, c, c.getValue()); }

        @Override
        public void onCharacteristicWrite(BluetoothGatt g, BluetoothGattCharacteristic c, int st) {
            done(st == BluetoothGatt.GATT_SUCCESS ? "true" : err("NetworkError"));
        }
        @Override
        public void onDescriptorWrite(BluetoothGatt g, BluetoothGattDescriptor d, int st) {
            done(st == BluetoothGatt.GATT_SUCCESS ? "true" : err("NetworkError"));
        }
    };
}
