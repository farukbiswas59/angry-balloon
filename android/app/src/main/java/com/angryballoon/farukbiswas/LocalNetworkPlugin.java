package com.angryballoon.farukbiswas;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.URI;
import java.nio.ByteBuffer;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.java_websocket.WebSocket;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.handshake.ServerHandshake;
import org.java_websocket.server.WebSocketServer;

@CapacitorPlugin(name = "LocalNetwork")
public class LocalNetworkPlugin extends Plugin {
    private LocalRoomDiscovery roomDiscovery;
    private LocalRoomBeacon roomBeacon;
    private WebSocketServer server;
    private final Map<String, WebSocket> peers = new ConcurrentHashMap<>();
    private final Map<WebSocket, String> peerIds = new ConcurrentHashMap<>();
    private final Map<String, WebSocketClient> clients = new ConcurrentHashMap<>();
    private static class Rate { long at = System.currentTimeMillis(); int count = 0; }
    private final Map<WebSocket, Rate> rates = new ConcurrentHashMap<>();

    @Override public void load() {
        roomDiscovery = new LocalRoomDiscovery(getContext(), event -> notifyListeners("discoveryEvent", event));
        roomBeacon = new LocalRoomBeacon(event -> notifyListeners("discoveryEvent", event));
    }
    @PluginMethod public void startDiscovery(PluginCall call) { roomDiscovery.start(); roomBeacon.start(); call.resolve(); }
    @PluginMethod public void stopDiscovery(PluginCall call) { roomDiscovery.stop(); roomBeacon.stop(); call.resolve(); }
    @PluginMethod public void advertiseRoom(PluginCall call) {
        String code = call.getString("code"), name = call.getString("hostName");
        if (server == null || code == null || !code.matches("[A-Z2-9]{5}") || name == null || name.length() > 16) { call.reject("Create a local room first."); return; }
        roomDiscovery.advertise(code, name, 3001); roomBeacon.advertise(code); call.resolve();
    }

    private void emit(String event, String type, String key, String id, String data) {
        JSObject payload = new JSObject();
        payload.put("type", type); payload.put(key, id);
        if (data != null) payload.put(type.equals("error") ? "message" : "data", data);
        notifyListeners(event, payload);
    }
    private JSArray addresses() throws Exception {
        JSArray addresses = new JSArray();
        for (NetworkInterface network : Collections.list(NetworkInterface.getNetworkInterfaces())) {
            if (!network.isUp() || network.isLoopback()) continue;
            for (InetAddress address : Collections.list(network.getInetAddresses())) {
                if (address.getAddress().length == 4 && address.isSiteLocalAddress()) addresses.put(address.getHostAddress());
            }
        }
        return addresses;
    }
    @PluginMethod public synchronized void startHost(PluginCall call) {
        if (server != null) { call.reject("A local host is already running."); return; }
        final JSArray ips;
        final java.util.concurrent.atomic.AtomicBoolean started = new java.util.concurrent.atomic.AtomicBoolean(false);
        try { ips = addresses(); } catch (Exception e) { call.reject("Could not read the local network address."); return; }
        if (ips.length() == 0) { call.reject("Connect to Wi-Fi or turn on a hotspot first."); return; }
        WebSocketServer candidate = new WebSocketServer(new InetSocketAddress("0.0.0.0", 3001), 2) {
            @Override public void onOpen(WebSocket socket, ClientHandshake handshake) {
                if (!"/socket".equals(handshake.getResourceDescriptor()) || peers.size() >= 12 || !"https://localhost".equals(handshake.getFieldValue("Origin"))) {
                    socket.close(1008, "Use the Angry Balloon app to join this local room."); return;
                }
                String peer = UUID.randomUUID().toString();
                peers.put(peer, socket); peerIds.put(socket, peer); rates.put(socket, new Rate());
                emit("hostEvent", "open", "peer", peer, null);
            }
            @Override public void onMessage(WebSocket socket, String data) {
                String peer = peerIds.get(socket); Rate rate = rates.get(socket);
                if (peer == null || rate == null) return;
                long now = System.currentTimeMillis();
                if (now - rate.at >= 1000) { rate.at = now; rate.count = 0; }
                if (data.length() > 2048 || ++rate.count > 80) { socket.close(1008, "Too many requests."); return; }
                emit("hostEvent", "message", "peer", peer, data);
            }
            @Override public void onMessage(WebSocket socket, ByteBuffer data) { socket.close(1003, "Text packets only."); }
            @Override public void onClose(WebSocket socket, int code, String reason, boolean remote) {
                String peer = peerIds.remove(socket); rates.remove(socket);
                if (peer != null) { peers.remove(peer); emit("hostEvent", "close", "peer", peer, null); }
            }
            @Override public void onError(WebSocket socket, Exception error) {
                if (socket == null && !started.get()) {
                    synchronized (LocalNetworkPlugin.this) { if (server == this) server = null; }
                    call.reject("Could not host on port 3001. Close other hosts and try again.");
                } else emit("hostEvent", "error", "peer", socket == null ? "" : peerIds.getOrDefault(socket, ""), "LAN connection interrupted.");
            }
            @Override public void onStart() {
                started.set(true);
                JSObject result = new JSObject(); result.put("addresses", ips); result.put("port", 3001); call.resolve(result);
            }
        };
        candidate.setReuseAddr(true); candidate.setConnectionLostTimeout(15);
        server = candidate; candidate.start();
    }
    @PluginMethod public synchronized void stopHost(PluginCall call) {
        roomDiscovery.stopAdvertising();
        roomBeacon.stopHost();
        if (server != null) {
            try { server.stop(1000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            server = null;
        }
        peers.clear(); peerIds.clear(); rates.clear(); call.resolve();
    }
    @PluginMethod public void sendHost(PluginCall call) {
        JSArray packets = call.getArray("packets");
        if (packets == null || packets.length() > 500) { call.reject("Invalid LAN packets."); return; }
        try {
            for (int i = 0; i < packets.length(); i++) {
                JSObject packet = JSObject.fromJSONObject(packets.getJSONObject(i));
                WebSocket socket = peers.get(packet.getString("peer"));
                String data = packet.getString("data");
                if (socket != null && socket.isOpen() && data != null) socket.send(data);
            }
            call.resolve();
        } catch (Exception e) { call.reject("LAN packet delivery failed."); }
    }
    private URI privateUrl(String value) throws Exception {
        URI uri = new URI(value);
        String host = uri.getHost(); int port = uri.getPort();
        if (!"ws".equals(uri.getScheme()) || host == null || !host.matches("\\d{1,3}(\\.\\d{1,3}){3}") || port < 1024 || port > 65535 || !"/socket".equals(uri.getPath()) || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null) throw new Exception();
        InetAddress address = InetAddress.getByName(host);
        if (!address.isSiteLocalAddress() && !address.isLoopbackAddress()) throw new Exception();
        return uri;
    }
    @PluginMethod public void connect(PluginCall call) {
        String clientId = call.getString("client"), value = call.getString("url");
        if (clientId == null || value == null || clients.size() >= 4) { call.reject("Invalid local connection."); return; }
        try {
            URI uri = privateUrl(value);
            Map<String, String> headers = new HashMap<>(); headers.put("Origin", "https://localhost");
            WebSocketClient client = new WebSocketClient(uri, headers) {
                @Override public void onOpen(ServerHandshake handshake) { emit("clientEvent", "open", "client", clientId, null); }
                @Override public void onMessage(String data) { emit("clientEvent", "message", "client", clientId, data); }
                @Override public void onClose(int code, String reason, boolean remote) {
                    clients.remove(clientId, this);
                    JSObject event = new JSObject(); event.put("type", "close"); event.put("client", clientId); event.put("code", code);
                    notifyListeners("clientEvent", event);
                }
                @Override public void onError(Exception error) { emit("clientEvent", "error", "client", clientId, null); }
            };
            client.setConnectionLostTimeout(15);
            clients.put(clientId, client); client.connect(); call.resolve();
        } catch (Exception e) { call.reject("Use a private Wi-Fi/hotspot IPv4 address and port 3001."); }
    }
    @PluginMethod public void sendClient(PluginCall call) {
        WebSocketClient client = clients.get(call.getString("client")); String data = call.getString("data");
        if (client == null || !client.isOpen() || data == null || data.length() > 2048) { call.reject("Local connection is closed."); return; }
        client.send(data); call.resolve();
    }
    @PluginMethod public void closeClient(PluginCall call) {
        WebSocketClient client = clients.remove(call.getString("client")); if (client != null) client.close(); call.resolve();
    }
    @Override protected void handleOnDestroy() {
        roomDiscovery.destroy();
        roomBeacon.destroy();
        for (WebSocketClient client : clients.values()) client.close(); clients.clear();
        if (server != null) try { server.stop(1000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        server = null; peers.clear(); peerIds.clear(); rates.clear();
    }
}
