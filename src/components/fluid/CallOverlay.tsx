import "@livekit/components-styles";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  VideoTrack,
} from "@livekit/components-react";
import { motion } from "framer-motion";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { Track } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import type { CallToken, CallType, Profile } from "@/types";

const SPRING = { type: "spring", stiffness: 300, damping: 25 } as const;

export interface ActiveCall {
  token: CallToken;
  peer: Profile;
  callType: CallType;
  direction: "incoming" | "outgoing";
}

interface Props {
  call: ActiveCall;
  /** Called once with the seconds connected (0 if nobody answered). */
  onEnd: (durationSeconds: number, answered: boolean) => void;
}

/** Full-screen LiveKit call: connects, shows peer video/avatar, ends live. */
export function CallOverlay({ call, onEnd }: Props) {
  const [connected, setConnected] = useState(false);
  const startedAt = useRef<number | null>(null);
  const answered = useRef(false);

  const finish = () => {
    const secs = startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0;
    onEnd(secs, answered.current);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={SPRING}
      className="fixed inset-0 z-[60] flex flex-col bg-background"
    >
      <div className="halo pointer-events-none absolute inset-x-0 top-0 h-72" />
      <LiveKitRoom
        serverUrl={call.token.url}
        token={call.token.token}
        connect
        audio
        video={call.callType === "video"}
        onConnected={() => setConnected(true)}
        onDisconnected={finish}
        onError={finish}
        className="relative flex flex-1 flex-col"
        data-lk-theme="default"
      >
        <RoomAudioRenderer />
        <Stage
          call={call}
          connected={connected}
          onPeerJoined={() => {
            if (!startedAt.current) startedAt.current = Date.now();
            answered.current = true;
          }}
        />
        <Controls video={call.callType === "video"} onHangup={finish} />
      </LiveKitRoom>
    </motion.div>
  );
}

function Stage({
  call,
  connected,
  onPeerJoined,
}: {
  call: ActiveCall;
  connected: boolean;
  onPeerJoined: () => void;
}) {
  const remotes = useRemoteParticipants();
  const peerHere = remotes.length > 0;
  useEffect(() => {
    if (peerHere) onPeerJoined();
  }, [peerHere, onPeerJoined]);

  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const remoteVideo = tracks.find((t) => !t.participant.isLocal && t.publication?.isSubscribed);
  const localVideo = tracks.find((t) => t.participant.isLocal);

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!peerHere) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [peerHere]);

  const label = !connected
    ? "Connecting…"
    : !peerHere
      ? call.direction === "outgoing"
        ? "Ringing…"
        : "Joining…"
      : `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
      {remoteVideo ? (
        <VideoTrack trackRef={remoteVideo} className="absolute inset-0 size-full object-cover" />
      ) : (
        <motion.div
          animate={peerHere ? { scale: 1 } : { scale: [1, 1.06, 1] }}
          transition={peerHere ? SPRING : { duration: 1.6, repeat: Infinity }}
          className="grid size-28 place-items-center overflow-hidden rounded-full bg-primary/20 text-4xl font-semibold text-primary shadow-[0_0_80px_-10px_var(--glow)]"
        >
          {call.peer.avatar_url ? (
            <img src={call.peer.avatar_url} alt="" className="size-28 object-cover" />
          ) : (
            call.peer.display_name.slice(0, 1)
          )}
        </motion.div>
      )}
      <div className="relative z-10 mt-6 text-center">
        <p className="text-2xl font-semibold text-glow">{call.peer.display_name}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">{label}</p>
      </div>
      {localVideo && (
        <div className="absolute right-4 top-6 z-10 aspect-[3/4] w-28 overflow-hidden rounded-2xl border border-border/60 bg-glass">
          <VideoTrack trackRef={localVideo} className="size-full object-cover" />
        </div>
      )}
    </div>
  );
}

function Controls({ video, onHangup }: { video: boolean; onHangup: () => void }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const btn =
    "grid size-14 place-items-center rounded-full bg-glass text-foreground backdrop-blur-xl";
  return (
    <div className="relative z-10 flex items-center justify-center gap-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-4">
      <motion.button
        whileTap={{ scale: 0.9 }}
        transition={SPRING}
        className={btn}
        aria-label={isMicrophoneEnabled ? "Mute" : "Unmute"}
        onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
      >
        {isMicrophoneEnabled ? <Mic className="size-6" /> : <MicOff className="size-6" />}
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.9 }}
        transition={SPRING}
        onClick={onHangup}
        className="grid size-16 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-[0_12px_40px_-12px_var(--destructive)]"
        aria-label="End call"
      >
        <PhoneOff className="size-7" />
      </motion.button>
      {video && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          transition={SPRING}
          className={btn}
          aria-label={isCameraEnabled ? "Camera off" : "Camera on"}
          onClick={() => void localParticipant.setCameraEnabled(!isCameraEnabled)}
        >
          {isCameraEnabled ? <Video className="size-6" /> : <VideoOff className="size-6" />}
        </motion.button>
      )}
    </div>
  );
}
