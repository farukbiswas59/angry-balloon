package com.angryballoon.farukbiswas;

import com.getcapacitor.JSObject;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.function.Consumer;

/** Small LAN-only query/response fallback for tethering networks that do not carry mDNS. */
final class LocalRoomBeacon {
    private static final int PORT = 3002;
    private static final String QUERY = "ANGRY_BALLOON_DISCOVER_1";
    private static final String REPLY = "ANGRY_BALLOON_ROOM_1:";
    private volatile DatagramSocket host;
    private volatile DatagramSocket browser;
    private final Consumer<JSObject> emit;
    LocalRoomBeacon(Consumer<JSObject> emit) { this.emit = emit; }
    private static boolean local(InetAddress address) { return address.getAddress().length == 4 && address.isSiteLocalAddress(); }
    synchronized void advertise(String code) {
        stopHost();
        try {
            DatagramSocket socket = new DatagramSocket(null);
            host = socket; socket.bind(new InetSocketAddress("0.0.0.0", PORT));
            Thread thread = new Thread(() -> {
                byte[] bytes = new byte[128]; long window = 0; int replies = 0;
                while (host == socket && !socket.isClosed()) try {
                    DatagramPacket packet = new DatagramPacket(bytes, bytes.length); socket.receive(packet);
                    if (!local(packet.getAddress()) || !QUERY.equals(new String(packet.getData(), 0, packet.getLength(), StandardCharsets.US_ASCII))) continue;
                    long now = System.nanoTime(); if (now - window > 1_000_000_000L) { window = now; replies = 0; }
                    if (++replies > 20) continue;
                    byte[] response = (REPLY + code + ":3001").getBytes(StandardCharsets.US_ASCII);
                    socket.send(new DatagramPacket(response, response.length, packet.getAddress(), packet.getPort()));
                } catch (Exception ignored) { break; }
                socket.close();
            }, "angry-balloon-room-beacon"); thread.setDaemon(true); thread.start();
        } catch (Exception ignored) { stopHost(); /* DNS-SD and manual joining remain available. */ }
    }
    private static Set<InetAddress> broadcasts() throws Exception {
        Set<InetAddress> result = new HashSet<>(); result.add(InetAddress.getByName("255.255.255.255"));
        for (NetworkInterface network : Collections.list(NetworkInterface.getNetworkInterfaces())) {
            if (!network.isUp() || network.isLoopback()) continue;
            for (InterfaceAddress address : network.getInterfaceAddresses())
                if (local(address.getAddress()) && address.getBroadcast() != null) result.add(address.getBroadcast());
        }
        return result;
    }
    synchronized void start() {
        if (browser != null) return;
        try {
            DatagramSocket socket = new DatagramSocket(); browser = socket; socket.setBroadcast(true); socket.setSoTimeout(1000);
            Thread thread = new Thread(() -> {
                byte[] bytes = new byte[128]; long nextQuery = 0;
                while (browser == socket && !socket.isClosed()) try {
                    long now = System.nanoTime();
                    if (now >= nextQuery) {
                        nextQuery = now + 4_000_000_000L;
                        byte[] query = QUERY.getBytes(StandardCharsets.US_ASCII);
                        for (InetAddress address : broadcasts()) try { socket.send(new DatagramPacket(query, query.length, address, PORT)); } catch (Exception ignored) { }
                    }
                    DatagramPacket packet = new DatagramPacket(bytes, bytes.length); socket.receive(packet);
                    if (!local(packet.getAddress())) continue;
                    String value = new String(packet.getData(), 0, packet.getLength(), StandardCharsets.US_ASCII);
                    if (!value.matches(REPLY + "[A-Z2-9]{5}:3001")) continue;
                    JSObject event = new JSObject(); event.put("type", "found");
                    event.put("service", "lan:" + packet.getAddress().getHostAddress() + ":3001");
                    event.put("address", packet.getAddress().getHostAddress()); event.put("port", 3001); emit.accept(event);
                } catch (SocketTimeoutException ignored) { /* Re-check stop and query deadline. */ }
                catch (Exception ignored) { if (socket.isClosed()) break; }
            }, "angry-balloon-room-search"); thread.setDaemon(true); thread.start();
        } catch (Exception ignored) { stop(); /* DNS-SD and manual joining remain available. */ }
    }
    synchronized void stopHost() { if (host != null) host.close(); host = null; }
    synchronized void stop() { if (browser != null) browser.close(); browser = null; }
    void destroy() { stop(); stopHost(); }
}
