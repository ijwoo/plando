package com.example.todo.repository;

import com.example.todo.entity.DmRoomRead;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DmRoomReadRepository extends JpaRepository<DmRoomRead, Long> {

    Optional<DmRoomRead> findByRoomIdAndUserId(Long roomId, Long userId);

    List<DmRoomRead> findByRoomId(Long roomId);
}
