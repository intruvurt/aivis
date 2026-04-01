import React from "react";
import { useQuery } from "react-query";
import { fetchStatusUpdates } from "../services/statusUpdates";

const StatusUpdatesList = () => {
  const { data, isLoading, isError } = useQuery(["statusUpdates"], fetchStatusUpdates, {
    staleTime: 1000 * 60,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) return <div id="src_components_statusupdateslist_l9y0" className="text-gray-400 text-center py-4">Loading status updates...</div>;
  if (isError || !data) return <div id="src_components_statusupdateslist_l9y1" className="text-red-400 text-center py-4">Could not load updates.</div>;

  return (
    <ul id="src_components_StatusUpdatesList_ck5g" className="divide-y divide-gray-700 mt-4">
      {data.length === 0 && <li id="src_components_statusupdateslist_l9y2" className="text-gray-500 text-center py-4 italic">No status updates yet.</li>}
      {data.map((update) => (
        <li key={update._id} className="py-3" id={`src_components_statusupdateslist_${update._id}`}>
          <span id="src_components_StatusUpdatesList_px7g" className="font-medium text-gray-200">{update.text}</span>
          <span id="src_components_StatusUpdatesList_if5o" className="text-xs text-gray-500 ml-2">
            {new Date(update.createdAt).toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
};

export default StatusUpdatesList;
