package com.angryballoon.farukbiswas;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import java.net.InetAddress;
import java.util.ArrayDeque;
import java.util.HashSet;
import java.util.Set;
import java.util.function.Consumer;

/** DNS-SD advertises only a room endpoint; the client checks availability with the host. */
final class LocalRoomDiscovery {
    private static final String TYPE = "_angryballoon._tcp.";
    private final NsdManager nsd;
    private final WifiManager wifi;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Consumer<JSObject> emit;
    private NsdManager.RegistrationListener registration;
    private NsdManager.DiscoveryListener discovery;
    private WifiManager.MulticastLock multicast;
    private final Set<String> found = new HashSet<>();
    private final ArrayDeque<NsdServiceInfo> pending = new ArrayDeque<>();
    private boolean resolving;
    private int generation;

    LocalRoomDiscovery(Context context, Consumer<JSObject> emit) {
        Context app = context.getApplicationContext();
        nsd = (NsdManager) app.getSystemService(Context.NSD_SERVICE);
        wifi = (WifiManager) app.getSystemService(Context.WIFI_SERVICE);
        this.emit = emit;
    }
    private void lock() {
        if (multicast == null && wifi != null) {
            multicast = wifi.createMulticastLock("angry-balloon-rooms");
            multicast.setReferenceCounted(false); multicast.acquire();
        }
    }
    private void unlockIfIdle() {
        if (registration == null && discovery == null && multicast != null) {
            if (multicast.isHeld()) multicast.release(); multicast = null;
        }
    }
    private void error() {
        JSObject event = new JSObject(); event.put("type", "error");
        event.put("message", "Room discovery is unavailable on this network. Join with the host address and room code.");
        emit.accept(event);
    }
    void advertise(String code, String hostName, int port) {
        handler.post(() -> {
            stopAdvertisingNow();
            if (nsd == null) { error(); return; }
            NsdServiceInfo info = new NsdServiceInfo();
            // Keep the DNS label within 63 UTF-8 bytes, including non-Latin names.
            String label = hostName.substring(0, Math.min(10, hostName.length()));
            info.setServiceName(label + " room " + code);
            info.setServiceType(TYPE); info.setPort(port);
            NsdManager.RegistrationListener listener = new NsdManager.RegistrationListener() {
                public void onServiceRegistered(NsdServiceInfo service) { handler.post(() -> {
                    if (registration != this) try { nsd.unregisterService(this); } catch (IllegalArgumentException ignored) { }
                }); }
                public void onRegistrationFailed(NsdServiceInfo service, int reason) { handler.post(() -> {
                    if (registration == this) { registration = null; unlockIfIdle(); error(); }
                }); }
                public void onServiceUnregistered(NsdServiceInfo service) { }
                public void onUnregistrationFailed(NsdServiceInfo service, int reason) { }
            };
            try { lock(); registration = listener; nsd.registerService(info, NsdManager.PROTOCOL_DNS_SD, listener); }
            catch (RuntimeException e) { registration = null; unlockIfIdle(); error(); }
        });
    }
    void stopAdvertising() { handler.post(this::stopAdvertisingNow); }
    private void stopAdvertisingNow() {
        NsdManager.RegistrationListener old = registration; registration = null;
        if (old != null) try { nsd.unregisterService(old); } catch (IllegalArgumentException ignored) { }
        unlockIfIdle();
    }
    void start() {
        handler.post(() -> {
            if (discovery != null) return;
            if (nsd == null) { error(); return; }
            NsdManager.DiscoveryListener listener = new NsdManager.DiscoveryListener() {
                public void onDiscoveryStarted(String type) { }
                public void onDiscoveryStopped(String type) { }
                public void onStartDiscoveryFailed(String type, int reason) { handler.post(() -> {
                    if (discovery == this) { stopNow(); error(); }
                }); }
                public void onStopDiscoveryFailed(String type, int reason) { }
                public void onServiceFound(NsdServiceInfo service) { handler.post(() -> {
                    if (discovery != this || !TYPE.equals(service.getServiceType()) || found.size() >= 64) return;
                    if (found.add(service.getServiceName())) { pending.add(service); resolveNext(); }
                }); }
                public void onServiceLost(NsdServiceInfo service) { handler.post(() -> {
                    if (discovery != this) return;
                    found.remove(service.getServiceName());
                    pending.removeIf(info -> info.getServiceName().equals(service.getServiceName()));
                    JSObject event = new JSObject(); event.put("type", "lost"); event.put("service", service.getServiceName()); emit.accept(event);
                }); }
            };
            try { lock(); discovery = listener; nsd.discoverServices(TYPE, NsdManager.PROTOCOL_DNS_SD, listener); }
            catch (RuntimeException e) { discovery = null; unlockIfIdle(); error(); }
        });
    }
    @SuppressWarnings("deprecation") // API 24 compatibility; each resolution uses its own listener.
    private void resolveNext() {
        if (resolving || discovery == null || pending.isEmpty()) return;
        NsdServiceInfo service = pending.remove();
        int requestGeneration = generation;
        resolving = true;
        NsdManager.ResolveListener listener = new NsdManager.ResolveListener() {
            public void onResolveFailed(NsdServiceInfo info, int reason) { handler.post(() -> {
                resolving = false;
                if (requestGeneration == generation) found.remove(service.getServiceName());
                resolveNext();
            }); }
            public void onServiceResolved(NsdServiceInfo info) { handler.post(() -> {
                resolving = false;
                InetAddress address = info.getHost();
                if (requestGeneration == generation && discovery != null && found.contains(service.getServiceName()) &&
                    address != null && address.getAddress().length == 4 && address.isSiteLocalAddress() && info.getPort() >= 1024 && info.getPort() <= 65535) {
                    JSObject event = new JSObject(); event.put("type", "found"); event.put("service", service.getServiceName());
                    event.put("address", address.getHostAddress()); event.put("port", info.getPort()); emit.accept(event);
                }
                resolveNext();
            }); }
        };
        try { nsd.resolveService(service, listener); }
        catch (RuntimeException e) { resolving = false; found.remove(service.getServiceName()); resolveNext(); }
    }
    void stop() { handler.post(this::stopNow); }
    private void stopNow() {
        generation++; found.clear(); pending.clear();
        NsdManager.DiscoveryListener old = discovery; discovery = null;
        if (old != null) try { nsd.stopServiceDiscovery(old); } catch (IllegalArgumentException ignored) { }
        unlockIfIdle();
    }
    void destroy() { handler.post(() -> { stopNow(); stopAdvertisingNow(); }); }
}
