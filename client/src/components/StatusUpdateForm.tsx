import React from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "react-query";
import { createStatusUpdate } from "../services/statusUpdates";
import toast from "react-hot-toast";

const StatusUpdateForm = () => {
  const { register, handleSubmit, reset } = useForm();
  const queryClient = useQueryClient();
  const mutation = useMutation(createStatusUpdate, {
    onSuccess: () => {
      queryClient.invalidateQueries(["statusUpdates"]);
      toast.success("Status updated!");
      reset();
    },
    onError: () => {
      toast.error("Unable to update status.");
    },
  });

  const onSubmit = (data) => {
    if (!data.text || typeof data.text !== "string" || data.text.length < 1) {
      toast.error("Status text is required.");
      return;
    }
    mutation.mutate({ text: data.text });
  };

  return (
    <form id="src_components_StatusUpdateForm_wpc1" onSubmit={handleSubmit(onSubmit)} className="flex items-center gap-2 mt-4">
      <input
        type="text"
        {...register("text")}
        placeholder="What's new?"
        maxLength={255}
        className="border border-gray-700 bg-gray-800 text-gray-100 p-2 rounded flex-grow focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label="Status update text input"
        id="src_components_statusupdateform_a7x4"
      />
      <button 
        id="src_components_StatusUpdateForm_kb8e" type="submit" 
        className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50"
        disabled={mutation.isLoading}
      >
        {mutation.isLoading ? "Posting..." : "Post"}
      </button>
    </form>
  );
};

export default StatusUpdateForm;
