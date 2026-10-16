package com.example.llm.model;

import java.util.HashMap;
import java.util.Map;

public class LlmDecision {
    private String action;
    private Map<String, Object> args = new HashMap<>();
    private String question;

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public Map<String, Object> getArgs() {
        return args;
    }

    public void setArgs(Map<String, Object> args) {
        this.args = (args == null) ? new HashMap<>() : args;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    @Override
    public String toString() {
        return "LlmDecision{" +
                "action='" + action + '\'' +
                ", args=" + args +
                ", question='" + question + '\'' +
                '}';
    }
}