package com.example.todo.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class StaticPageController {

    @GetMapping("/privacy")
    public String privacy() {
        return "redirect:/privacy.html";
    }
}
