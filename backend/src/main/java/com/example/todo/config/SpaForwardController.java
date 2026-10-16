package com.example.todo.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {

    @GetMapping({
            "/",
            "/login",
            "/dashboard",
            "/calendar",
            "/todos",
            "/tasklist",
            "/settings",
            "/dm",
            "/join"
    })
    public String forward() {
        return "forward:/index.html";
    }
}