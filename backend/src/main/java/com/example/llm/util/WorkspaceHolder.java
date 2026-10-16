package com.example.llm.util;

public class WorkspaceHolder {

    private static final ThreadLocal<Long> holder = new ThreadLocal<>();

    public static void set(Long workspaceId) {
        holder.set(workspaceId);
    }

    public static Long get() {
        return holder.get();
    }

    public static void clear() {
        holder.remove();
    }
}
