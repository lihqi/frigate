import { useFrigateReviews } from "@/api/ws";
import Logo from "@/components/Logo";
import { AnimatedEventThumbnail } from "@/components/image/AnimatedEventThumbnail";
import LivePlayer from "@/components/player/LivePlayer";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePersistence } from "@/hooks/use-persistence";
import { CameraConfig } from "@/types/frigateConfig";
import { ReviewSegment } from "@/types/review";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isDesktop, isMobile, isSafari } from "react-device-detect";
import { CiGrid2H, CiGrid31 } from "react-icons/ci";
import useSWR from "swr";

type LiveDashboardViewProps = {
  cameras: CameraConfig[];
  onSelectCamera: (camera: string) => void;
};
export default function LiveDashboardView({
  cameras,
  onSelectCamera,
}: LiveDashboardViewProps) {
  // layout

  const [layout, setLayout] = usePersistence<"grid" | "list">(
    "live-layout",
    isDesktop ? "grid" : "list",
  );

  // recent events
  const { payload: eventUpdate } = useFrigateReviews();
  const { data: allEvents, mutate: updateEvents } = useSWR<ReviewSegment[]>([
    "review",
    { limit: 10, severity: "alert" },
  ]);

  useEffect(() => {
    if (!eventUpdate) {
      return;
    }

    // if event is ended and was saved, update events list
    if (eventUpdate.type == "end" && eventUpdate.review.severity == "alert") {
      updateEvents();
      return;
    }
  }, [eventUpdate, updateEvents]);

  const events = useMemo(() => {
    if (!allEvents) {
      return [];
    }

    const date = new Date();
    date.setHours(date.getHours() - 1);
    const cutoff = date.getTime() / 1000;
    return allEvents.filter((event) => event.start_time > cutoff);
  }, [allEvents]);

  // camera live views

  const [windowVisible, setWindowVisible] = useState(true);
  const visibilityListener = useCallback(() => {
    setWindowVisible(document.visibilityState == "visible");
  }, []);

  useEffect(() => {
    addEventListener("visibilitychange", visibilityListener);

    return () => {
      removeEventListener("visibilitychange", visibilityListener);
    };
  }, [visibilityListener]);

  return (
    <div className="size-full overflow-y-scroll px-2">
      {isMobile && (
        <div className="relative h-9 flex items-center justify-between">
          <Logo className="absolute inset-y-0 inset-x-1/2 -translate-x-1/2 h-8" />
          <div />
          <div className="flex items-center gap-1">
            <Button
              className={layout == "grid" ? "text-blue-600 bg-blue-200" : ""}
              size="xs"
              variant="secondary"
              onClick={() => setLayout("grid")}
            >
              <CiGrid31 className="m-1" />
            </Button>
            <Button
              className={layout == "list" ? "text-blue-600 bg-blue-200" : ""}
              size="xs"
              variant="secondary"
              onClick={() => setLayout("list")}
            >
              <CiGrid2H className="m-1" />
            </Button>
          </div>
        </div>
      )}

      {events && events.length > 0 && (
        <ScrollArea>
          <TooltipProvider>
            <div className="flex">
              {events.map((event) => {
                return <AnimatedEventThumbnail key={event.id} event={event} />;
              })}
            </div>
          </TooltipProvider>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      <div
        className={`mt-4 grid ${layout == "grid" ? "grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4" : ""} gap-2 md:gap-4  *:rounded-2xl *:bg-black`}
      >
        {cameras.map((camera) => {
          let grow;
          const aspectRatio = camera.detect.width / camera.detect.height;
          if (aspectRatio > 2) {
            grow = `${layout == "grid" ? "col-span-2" : ""} aspect-wide`;
          } else if (aspectRatio < 1) {
            grow = `${layout == "grid" ? "row-span-2 aspect-tall md:h-full" : ""} aspect-tall`;
          } else {
            grow = "aspect-video";
          }
          return (
            <LivePlayer
              key={camera.name}
              className={grow}
              windowVisible={windowVisible}
              cameraConfig={camera}
              preferredLiveMode={isSafari ? "webrtc" : "mse"}
              onClick={() => onSelectCamera(camera.name)}
            />
          );
        })}
      </div>
    </div>
  );
}
