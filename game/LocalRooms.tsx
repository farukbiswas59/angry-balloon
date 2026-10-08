"use client";
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Radio, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { discoverLocalRooms } from './lan-native';
import type { DiscoveredRoom } from './lan-discovery';

export default function LocalRooms({ join, manual }: { join: (room: DiscoveredRoom) => void; manual: () => void }) {
  const [rooms, setRooms] = useState<DiscoveredRoom[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const scan = useRef<Awaited<ReturnType<typeof discoverLocalRooms>> | null>(null);
  useEffect(() => {
    let disposed = false;
    void discoverLocalRooms(value => { if (!disposed) setRooms(value); }, message => { if (!disposed) setError(message); })
      .then(value => { if (disposed) void value.stop(); else scan.current = value; })
      .catch(reason => { if (!disposed) setError(reason instanceof Error ? reason.message : 'Join manually if discovery is unavailable.'); });
    return () => { disposed = true; void scan.current?.stop(); scan.current = null; };
  }, []);
  return <section className="local-room-browser" aria-label="Available local rooms">
    <div className="local-room-heading"><span><Radio size={15} /> AVAILABLE ROOMS</span><Button type="button" aria-label="Refresh rooms" disabled={refreshing} onClick={async () => {
      if (!scan.current) return;
      setRefreshing(true); setError('');
      try { await scan.current.refresh(); } catch { setError('Could not refresh rooms. You can still join manually.'); }
      finally { setRefreshing(false); }
    }}><RefreshCw size={15} /> {refreshing ? 'REFRESHING…' : 'REFRESH ROOMS'}</Button></div>
    <div className="local-room-list" aria-live="polite">
      {rooms.length ? rooms.map(room => <Button type="button" className="local-room" key={room.service} onClick={() => join(room)}>
        <span><b>{room.name}</b><small>{room.players}/{room.maxPlayers} players · {room.address.replace(/^http:\/\//, '')}</small></span><span className="local-room-join">JOIN <ArrowRight size={17} /></span>
      </Button>) : <p className="local-room-empty">{error || 'Looking for rooms… Ask a friend to host on this Wi-Fi or hotspot.'}</p>}
    </div>
    <div className="local-room-footer"><span>{rooms.length ? 'Rooms update automatically.' : 'No room showing up?'}</span><Button type="button" onClick={manual}>JOIN MANUALLY <ArrowRight size={13} /></Button></div>
    {!!rooms.length && error && <p className="local-room-error" role="status">{error}</p>}
  </section>;
}
